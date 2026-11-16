import "server-only";
import type Stripe from "stripe";
import {
  guestStripeIdempotencyKey,
  guestStripeSessionParams,
} from "./guest-stripe-session";
import { stripeClient, stripePaymentsConfigured } from "./stripe";
import { serviceClient } from "./supabase/server";

type GuestAttempt = {
  attempt_id: string;
  order_id: string;
  session_id: string | null;
  attempt_status: "created" | "open";
  idempotency_key: string;
  amount_cents: number;
  customer_email: string;
  currency: string;
  items: unknown;
  shipping_fee_cents: number;
  insurance_fee_cents: number;
  shipping_service: "tracked" | "express" | null;
  expires_at: string;
};

type GuestItem = {
  name: string;
  priceCents: number;
};

function paymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"],
) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string"
    ? paymentIntent
    : paymentIntent.id;
}

function parseItems(value: unknown): GuestItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Guest reconciliation payload has no items");
  }

  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { name?: unknown }).name !== "string" ||
      !Number.isInteger((item as { priceCents?: unknown }).priceCents) ||
      Number((item as { priceCents: number }).priceCents) < 0
    ) {
      throw new Error("Guest reconciliation payload has invalid items");
    }

    return {
      name: (item as { name: string }).name,
      priceCents: Number(
        (item as { priceCents: number }).priceCents,
      ),
    };
  });
}

function validateAttempt(attempt: GuestAttempt) {
  const items = parseItems(attempt.items);
  const shippingFeeCents = Number(attempt.shipping_fee_cents);
  const insuranceFeeCents = Number(attempt.insurance_fee_cents);
  const amountCents = Number(attempt.amount_cents);
  const expiresAt = new Date(attempt.expires_at).getTime();

  if (
    !attempt.attempt_id ||
    !attempt.order_id ||
    !attempt.idempotency_key ||
    !attempt.customer_email ||
    !attempt.currency
  ) {
    throw new Error("Guest reconciliation payload is incomplete");
  }

  if (
    !Number.isInteger(shippingFeeCents) ||
    shippingFeeCents < 0 ||
    !Number.isSafeInteger(insuranceFeeCents) ||
    insuranceFeeCents < 0 ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    !Number.isFinite(expiresAt)
  ) {
    throw new Error("Guest reconciliation payload is invalid");
  }

  const expectedAmount =
    items.reduce((sum, item) => sum + item.priceCents, 0) +
    shippingFeeCents +
    insuranceFeeCents;

  if (expectedAmount !== amountCents) {
    throw new Error("Guest reconciliation amount does not match order");
  }

  return {
    items,
    shippingFeeCents,
    insuranceFeeCents,
    shippingService: attempt.shipping_service,
    expiresAt,
  };
}

async function recordResult(
  db: Awaited<ReturnType<typeof serviceClient>>,
  attempt: GuestAttempt,
  session: Stripe.Checkout.Session,
  result: "success" | "expired",
) {
  const { error } = await db.rpc(
    "cms_record_guest_stripe_webhook",
    {
      p_event_id:
        `guest_reconcile_${session.id}_${result}`,
      p_event_type:
        result === "success"
          ? "checkout.session.completed"
          : "checkout.session.expired",
      p_attempt_id: attempt.attempt_id,
      p_session_id: session.id,
      p_payment_intent_id:
        paymentIntentId(session.payment_intent),
      p_result: result,
    },
  );

  if (error) throw error;
}

async function settleSession(
  db: Awaited<ReturnType<typeof serviceClient>>,
  stripe: ReturnType<typeof stripeClient>,
  attempt: GuestAttempt,
  initialSession?: Stripe.Checkout.Session,
) {
  let session =
    initialSession ??
    (await stripe.checkout.sessions.retrieve(
      String(attempt.session_id),
    ));

  if (
    session.status === "complete" &&
    session.payment_status === "paid"
  ) {
    await recordResult(db, attempt, session, "success");
    return true;
  }

  if (session.status === "expired") {
    await recordResult(db, attempt, session, "expired");
    return true;
  }

  if (
    session.status === "complete" &&
    session.payment_status !== "paid"
  ) {
    // Stripe may still be confirming an asynchronous payment.
    // Keep the reservation and let a later webhook/reconciliation settle it.
    return false;
  }

  const expiresAt = new Date(attempt.expires_at).getTime();

  if (session.status === "open" && expiresAt <= Date.now()) {
    try {
      session = await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Expire can race with payment completion. Re-read Stripe instead of
      // assuming the Checkout is safely expired.
      session = await stripe.checkout.sessions.retrieve(session.id);
    }

    if (
      session.status === "complete" &&
      session.payment_status === "paid"
    ) {
      await recordResult(db, attempt, session, "success");
      return true;
    }

    if (session.status === "expired") {
      await recordResult(db, attempt, session, "expired");
      return true;
    }

    if (
      session.status === "complete" &&
      session.payment_status !== "paid"
    ) {
      return false;
    }

    throw new Error(
      "Guest Checkout remained open after its reservation deadline",
    );
  }

  return false;
}

async function reconcileAttempt(
  db: Awaited<ReturnType<typeof serviceClient>>,
  stripe: ReturnType<typeof stripeClient>,
  attempt: GuestAttempt,
) {
  const validated = validateAttempt(attempt);

  if (attempt.session_id) {
    return settleSession(db, stripe, attempt);
  }

  if (attempt.attempt_status !== "created") {
    throw new Error(
      "Guest payment attempt has no Stripe session but is not creatable",
    );
  }

  // A missing session ID may mean the original Stripe create request had an
  // ambiguous network outcome. Replay the exact request with the exact same
  // idempotency key while the original expires_at is still valid.
  const session = await stripe.checkout.sessions.create(
    guestStripeSessionParams({
      attemptId: attempt.attempt_id,
      orderId: attempt.order_id,
      customerEmail: attempt.customer_email,
      currency: attempt.currency,
      items: validated.items,
      shippingFeeCents: validated.shippingFeeCents,
      shippingService: validated.shippingService,
      insuranceFeeCents: validated.insuranceFeeCents,
      expiresAt: attempt.expires_at,
    }),
    {
      idempotencyKey:
        guestStripeIdempotencyKey(attempt.idempotency_key),
    },
  );

  const { data: attached, error: attachError } = await db.rpc(
    "cms_attach_guest_stripe_session",
    {
      p_attempt_id: attempt.attempt_id,
      p_session_id: session.id,
    },
  );

  if (attachError) throw attachError;

  if (attached !== true) {
    throw new Error(
      "Recovered Guest Checkout could not be attached safely",
    );
  }

  // Early recovery exists specifically so an ambiguous create can be attached
  // before Stripe's expires_at becomes invalid. Do not expire a healthy
  // recovered Checkout before the reservation deadline.
  if (validated.expiresAt > Date.now()) {
    return true;
  }

  return settleSession(
    db,
    stripe,
    { ...attempt, session_id: session.id },
    session,
  );
}

export async function reconcileDueGuestStripeAttempts(
  limit = 5,
) {
  if (!stripePaymentsConfigured()) {
    return { reconciled: 0, errors: 0 };
  }

  const db = await serviceClient();
  const stripe = stripeClient();

  const { data, error } = await db.rpc(
    "cms_due_guest_stripe_attempts",
    { p_limit: limit },
  );

  if (error) throw error;

  const attempts = (data || []) as GuestAttempt[];
  let reconciled = 0;
  let errors = 0;

  for (const attempt of attempts) {
    try {
      if (await reconcileAttempt(db, stripe, attempt)) {
        reconciled += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        "Guest Stripe reconciliation failed",
        attempt.attempt_id,
        error,
      );
    }
  }

  return { reconciled, errors };
}
