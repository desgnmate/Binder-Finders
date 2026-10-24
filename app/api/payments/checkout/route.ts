import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { stripeClient, stripePaymentsConfigured } from "../../../../lib/stripe";
import { serviceClient, sessionClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  holdId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("Stripe payments are not configured"))
    return "Online payment is not configured yet. Please contact the store.";
  if (error instanceof Error && /already been paid|Only accepted|expired|Request not found|payment is due|being prepared|being confirmed|at least 31 minutes/i.test(error.message))
    return error.message;
  return "Unable to start payment. Please refresh the order and try again.";
}

function errorStatus(error: unknown) {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof Error && error.message.includes("Stripe payments are not configured")) return 503;
  if (error instanceof Error && /already been paid|Only accepted|expired|Request not found|payment is due|being prepared|being confirmed|at least 31 minutes/i.test(error.message)) return 409;
  return 502;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (process.env.CMS_ENABLED !== "true")
    return NextResponse.json({ error: "Payments are not enabled yet. Please contact the store." }, { status: 503 });
  if (!stripePaymentsConfigured())
    return NextResponse.json({ error: "Online payment is not configured yet. Please contact the store." }, { status: 503 });

  const customerDb = await sessionClient();
  const { data: { user }, error: authError } = await customerDb.auth.getUser();
  if (authError || !user?.email_confirmed_at)
    return NextResponse.json({ error: "Sign in with a verified customer account before paying." }, { status: 401 });

  let db: ReturnType<typeof serviceClient> | null = null;
  let attemptId: string | null = null;
  let creatingSession = false;
  try {
    const stripe = stripeClient();
    const payload = schema.parse(await request.json());
    db = serviceClient();
    const { data: payment, error: beginError } = await db.rpc("cms_begin_stripe_payment", {
      p_hold_id: payload.holdId,
      p_customer_user_id: user.id,
      p_idempotency_key: payload.idempotencyKey,
    });
    if (beginError) throw new Error(beginError.message);

    if (payment?.state === "paid")
      return NextResponse.json({ error: "This request has already been paid." }, { status: 409 });
    if (payment?.state === "in_progress" && !payment.sessionId)
      return NextResponse.json({ error: "A payment session is already being prepared. Please try again shortly." }, { status: 409 });

    attemptId = payment?.attemptId || null;
    let session: Stripe.Checkout.Session;
    if (payment?.sessionId) {
      session = await stripe.checkout.sessions.retrieve(payment.sessionId);
      if (session.status === "expired") {
        if (attemptId) await db.rpc("cms_fail_stripe_payment", {
          p_attempt_id: attemptId,
          p_status: "expired",
          p_reason: "Checkout session expired",
        });
        return NextResponse.json({ error: "This payment session has expired. Start payment again from the order." }, { status: 409 });
      }
      if (session.status !== "open" || !session.url)
        return NextResponse.json({ error: "Payment is being confirmed. Refresh this order shortly." }, { status: 409 });
    } else {
      const items = Array.isArray(payment?.items) ? payment.items as { name: string; priceCents: number }[] : [];
      if (!payment?.attemptId || !payment?.holdId || !payment?.amountCents || !items.length)
        throw new Error("Payment details are unavailable");
      creatingSession = true;
      const { data: hold, error: holdError } = await db.from("hold_requests")
        .select("expires_at").eq("id", payment.holdId).single();
      if (holdError || !hold?.expires_at) throw new Error("This hold has expired");
      // Stripe requires at least 30 minutes. Leave a minute for network delay
      // and never let Checkout outlive the reserved inventory's deadline.
      const now = Date.now();
      const deadline = new Date(hold.expires_at).getTime();
      if (deadline - now < 31 * 60_000)
        throw new Error("At least 31 minutes must remain on the hold to start payment. Please contact the store to extend it.");
      const checkoutExpiresAt = Math.floor(Math.min(deadline, now + 23 * 60 * 60_000) / 1000);
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        expires_at: checkoutExpiresAt,
        line_items: items.map((item) => ({
          quantity: 1,
          price_data: {
            currency: String(payment.currency).toLowerCase(),
            unit_amount: item.priceCents,
            product_data: { name: item.name.slice(0, 250) },
          },
        })),
        customer_email: String(payment.customerEmail),
        client_reference_id: String(payment.holdId),
        metadata: {
          hold_id: String(payment.holdId),
          payment_attempt_id: String(payment.attemptId),
        },
        payment_intent_data: {
          metadata: {
            hold_id: String(payment.holdId),
            payment_attempt_id: String(payment.attemptId),
          },
        },
        success_url: `${request.nextUrl.origin}/account/orders/${payment.holdId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.nextUrl.origin}/account/orders/${payment.holdId}?payment=cancelled`,
      }, { idempotencyKey: `binderfinders-payment-${payload.idempotencyKey}` });
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      const { data: attached, error: attachError } = await db.rpc("cms_attach_stripe_session", {
        p_attempt_id: payment.attemptId,
        p_session_id: session.id,
      });
      if (attachError || attached !== true) {
        // The customer never receives this URL, so close it at Stripe rather
        // than leave a payable session the hold guard no longer tracks.
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
        await db.rpc("cms_fail_stripe_payment", {
          p_attempt_id: payment.attemptId,
          p_status: "failed",
          p_reason: "Checkout session could not be attached",
        });
        throw new Error("Checkout session could not be attached");
      }
      creatingSession = false;
    }
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (creatingSession && attemptId && db) {
      await db.rpc("cms_fail_stripe_payment", {
        p_attempt_id: attemptId,
        p_status: "failed",
        p_reason: "Checkout session creation failed",
      });
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: errorStatus(error) });
  }
}
