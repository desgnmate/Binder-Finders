import { createHash } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import {
  belowCardPaymentMinimum,
  belowMinimumMessage,
} from "../../../lib/cms/payments";
import { stripeClient, stripePaymentsConfigured } from "../../../lib/stripe";
import { serviceClient } from "../../../lib/supabase/server";
import {
  guestStripeIdempotencyKey,
  guestStripeSessionParams,
} from "../../../lib/guest-stripe-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().min(2).max(100),
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  fulfillmentMethod: z.enum(["pickup", "shipping"]),
  shippingAddress: shippingAddressSchema.nullable().optional(),
  cardIds: z.array(z.string().min(1).max(100)).min(1).max(30),
  requestKey: z.string().uuid(),
  paymentKey: z.string().uuid(),
  website: z.string().max(0),
}).superRefine((value, ctx) => {
  if (value.fulfillmentMethod === "shipping" && !value.shippingAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shippingAddress"],
      message: "Shipping address is required",
    });
  }

  if (value.fulfillmentMethod === "pickup" && value.shippingAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shippingAddress"],
      message: "Pickup does not require a shipping address",
    });
  }

  if (new Set(value.cardIds).size !== value.cardIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cardIds"],
      message: "Selected cards must be unique",
    });
  }
});

type GuestPayment = {
  state?: string;
  attemptId?: string;
  sessionId?: string | null;
  orderId?: string;
  customerEmail?: string;
  customerName?: string;
  currency?: string;
  amountCents?: number;
  items?: { name: string; priceCents: number }[];
  shippingFeeCents?: number;
  expiresAt?: string;
};

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function isBelowMinimum(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message === belowMinimumMessage ||
    error.message.includes("amount_cents_check") ||
    (error as { code?: string }).code === "amount_too_small";
}

function safeError(error: unknown) {
  if (isBelowMinimum(error)) return belowMinimumMessage;

  if (
    error instanceof Error &&
    /no longer available|currently unavailable|Shipping is not configured|currency is not configured|already been paid|no longer available for payment|cannot be paid|reservation has expired|31 minutes|payment attempt is closed|pricing is inconsistent/i.test(
      error.message,
    )
  ) {
    return error.message;
  }

  if (
    error instanceof Error &&
    error.message.includes("Stripe payments are not configured")
  ) {
    return "Online payment is not configured yet. Please contact the store.";
  }

  return "Unable to start Guest Checkout. Your reserved cards are safe while payment is being resolved. Please try again.";
}

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  if (isBelowMinimum(error)) return 409;

  if (
    error instanceof Error &&
    error.message.includes("Stripe payments are not configured")
  ) {
    return 503;
  }

  if (
    error instanceof Error &&
    /no longer available|currently unavailable|Shipping is not configured|currency is not configured|already been paid|no longer available for payment|cannot be paid|reservation has expired|31 minutes|payment attempt is closed|pricing is inconsistent/i.test(
      error.message,
    )
  ) {
    return 409;
  }

  return 502;
}

async function recordStripeResult(
  db: ReturnType<typeof serviceClient>,
  session: Stripe.Checkout.Session,
  attemptId: string,
  result: "success" | "pending" | "failed" | "expired",
  reason?: string,
) {
  const { error } = await db.rpc("cms_record_guest_stripe_webhook", {
    p_event_id: `guest_route_${session.id}_${result}`,
    p_event_type: `guest.route.${result}`,
    p_attempt_id: attemptId,
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId(session),
    p_result: result,
    p_reason: reason ?? null,
  });

  if (error) throw new Error(error.message);
}

async function closeConfirmedUnattachedSession(
  db: ReturnType<typeof serviceClient>,
  stripe: ReturnType<typeof stripeClient>,
  attemptId: string,
  session: Stripe.Checkout.Session,
) {
  let confirmedExpired = false;

  try {
    const expired = await stripe.checkout.sessions.expire(session.id);
    confirmedExpired = expired.status === "expired";
  } catch {
    try {
      const current = await stripe.checkout.sessions.retrieve(session.id);
      confirmedExpired = current.status === "expired";
    } catch {
      // Ambiguous Stripe state: leave the created attempt recoverable.
    }
  }

  if (!confirmedExpired) return false;

  const { data, error } = await db.rpc(
    "cms_close_unattached_guest_stripe_attempt",
    {
      p_attempt_id: attemptId,
      p_status: "expired",
      p_reason: "Checkout session could not be attached and was expired",
    },
  );

  if (error) throw new Error(error.message);
  return data === true;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  if (process.env.CMS_ENABLED !== "true") {
    return NextResponse.json(
      {
        error:
          "Guest Checkout is not enabled yet. Please contact the store.",
      },
      { status: 503 },
    );
  }

  if (!stripePaymentsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Online payment is not configured yet. Please contact the store.",
      },
      { status: 503 },
    );
  }

  if (Number(request.headers.get("content-length")) > 12000) {
    return NextResponse.json(
      { error: "Request too large" },
      { status: 413 },
    );
  }

  try {
    const text = await request.text();

    if (text.length > 12000) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413 },
      );
    }

    const payload = schema.parse(JSON.parse(text));
    const db = serviceClient();
    const stripe = stripeClient();

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIp =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";

    const configuredRateLimitSalt =
      process.env.GUEST_CHECKOUT_RATE_LIMIT_SALT?.trim();

    if (
      process.env.NODE_ENV === "production" &&
      (!configuredRateLimitSalt || configuredRateLimitSalt.length < 32)
    ) {
      throw new Error("Guest Checkout protection is not configured");
    }

    const rateLimitSalt =
      configuredRateLimitSalt || "binderfinders-local";

    const normalizedEmail = payload.email.trim().toLowerCase();

    const ipHash = createHash("sha256")
      .update(`${rateLimitSalt}:ip:${clientIp}`)
      .digest("hex");

    const emailHash = createHash("sha256")
      .update(`${rateLimitSalt}:email:${normalizedEmail}`)
      .digest("hex");

    const { data: rateAllowed, error: rateError } = await db.rpc(
      "cms_check_guest_checkout_rate_limit",
      {
        p_request_key: payload.requestKey,
        p_ip_hash: ipHash,
        p_email_hash: emailHash,
      },
    );

    if (rateError) {
      throw new Error("Guest Checkout protection is temporarily unavailable");
    }

    if (rateAllowed !== true) {
      return NextResponse.json(
        {
          error:
            "Too many checkout attempts. Please wait a few minutes and try again.",
        },
        {
          status: 429,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const { data: reservation, error: reservationError } = await db.rpc(
      "cms_begin_guest_checkout",
      {
        p_request: {
          requestKey: payload.requestKey,
          name: payload.name,
          email: payload.email.toLowerCase(),
          fulfillmentMethod: payload.fulfillmentMethod,
          shippingAddress:
            payload.fulfillmentMethod === "shipping"
              ? payload.shippingAddress
              : null,
          cardIds: payload.cardIds,
        },
      },
    );

    if (reservationError) {
      throw new Error(reservationError.message);
    }

    if (!reservation?.orderId) {
      throw new Error("Guest Checkout reservation could not be created");
    }

    // Inventory is now reserved even if Stripe later has a temporary error.
    revalidateTag("store-catalog");

    const { data: paymentData, error: paymentError } = await db.rpc(
      "cms_begin_guest_stripe_payment",
      {
        p_order_id: reservation.orderId,
        p_idempotency_key: payload.paymentKey,
      },
    );

    if (paymentError) throw new Error(paymentError.message);

    const payment = paymentData as GuestPayment | null;

    if (!payment?.attemptId || !payment.orderId) {
      throw new Error("Guest payment details are unavailable");
    }

    if (payment.state === "paid") {
      return NextResponse.json(
        {
          status: "paid",
            orderId: payment.orderId,
            sessionId: payment.sessionId,
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (payment.state === "in_progress" && !payment.sessionId) {
      return NextResponse.json(
        {
          error:
            "A Guest Checkout payment session is already being prepared. Please retry with the same payment request.",
          orderId: payment.orderId,
        },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    let session: Stripe.Checkout.Session;

    if (payment.sessionId) {
      session = await stripe.checkout.sessions.retrieve(payment.sessionId);

      if (
        session.status === "complete" &&
        session.payment_status === "paid"
      ) {
        await recordStripeResult(
          db,
          session,
          payment.attemptId,
          "success",
        );

        revalidateTag("store-catalog");

        return NextResponse.json(
          {
            status: "paid",
            orderId: payment.orderId,
            sessionId: payment.sessionId,
          },
          {
            status: 200,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }

      if (session.status === "expired") {
        await recordStripeResult(
          db,
          session,
          payment.attemptId,
          "expired",
          "Checkout session expired",
        );

        return NextResponse.json(
          {
            error:
              "This payment session has expired. Start payment again.",
            orderId: payment.orderId,
          },
          {
            status: 409,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }

      if (session.status !== "open" || !session.url) {
        await recordStripeResult(
          db,
          session,
          payment.attemptId,
          "pending",
          "Checkout payment is being confirmed",
        );

        return NextResponse.json(
          {
            error:
              "Payment is being confirmed. Please check again shortly.",
            orderId: payment.orderId,
          },
          {
            status: 409,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }
    } else {
      const items = Array.isArray(payment.items) ? payment.items : [];
      const amountCents = Number(payment.amountCents);
      const shippingFeeCents = Number(payment.shippingFeeCents || 0);
      const currency = String(payment.currency || "").toLowerCase();
      const expiresAt = new Date(String(payment.expiresAt)).getTime();

      if (
        !items.length ||
        !Number.isInteger(amountCents) ||
        amountCents <= 0 ||
        !currency ||
        !Number.isFinite(expiresAt)
      ) {
        throw new Error("Guest payment details are unavailable");
      }

      if (belowCardPaymentMinimum(currency, amountCents)) {
        const { error: closeError } = await db.rpc(
          "cms_close_unattached_guest_stripe_attempt",
          {
            p_attempt_id: payment.attemptId,
            p_status: "failed",
            p_reason: "Amount is below the Stripe card payment minimum",
          },
        );

        if (closeError) {
          throw new Error(
            "Guest payment attempt could not be closed safely",
          );
        }

        throw new Error(belowMinimumMessage);
      }

      // Do not replace this with "now + N". The reservation deadline is fixed,
      // so retries use exactly the same Stripe create parameters.
      // If this call has an ambiguous network outcome, deliberately do not
      // mark the DB attempt failed. Repeating the same paymentKey replays the
      // exact same Stripe idempotency request and can recover the session.
      session = await stripe.checkout.sessions.create(
        guestStripeSessionParams({
          attemptId: payment.attemptId,
          orderId: payment.orderId,
          customerEmail: String(payment.customerEmail),
          currency,
          items: items.map((item) => ({
            name: String(item.name),
            priceCents: Number(item.priceCents),
          })),
          shippingFeeCents,
          expiresAt: String(payment.expiresAt),
        }),
        {
          idempotencyKey:
            guestStripeIdempotencyKey(payload.paymentKey),
        },
      );

      const { data: attached, error: attachError } = await db.rpc(
        "cms_attach_guest_stripe_session",
        {
          p_attempt_id: payment.attemptId,
          p_session_id: session.id,
        },
      );

      if (attachError || attached !== true) {
        const closed = await closeConfirmedUnattachedSession(
          db,
          stripe,
          payment.attemptId,
          session,
        );

        if (closed) {
          throw new Error(
            "Checkout session could not be attached. Please start payment again.",
          );
        }

        // Stripe state is not proven terminal. Keep this exact attempt and
        // paymentKey recoverable rather than risking a duplicate payment.
        throw new Error(
          "Payment session status is uncertain. Please retry this payment request.",
        );
      }

      if (!session.url) {
        throw new Error(
          "Payment session was created but no checkout URL is available.",
        );
      }
    }

    return NextResponse.json(
      {
        url: session.url,
        orderId: payment.orderId,
        expiresAt: payment.expiresAt,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error) },
      {
        status: errorStatus(error),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}







