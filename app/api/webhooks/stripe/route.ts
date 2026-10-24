import type Stripe from "stripe";
import { stripeClient } from "../../../../lib/stripe";
import { serviceClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sessionData(event: Stripe.Event) {
  return event.data.object as Stripe.Checkout.Session;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature)
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Stripe payments are not configured"))
      return Response.json({ error: "Webhook is not configured" }, { status: 503 });
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let session: Stripe.Checkout.Session | null = null;
  let result: "success" | "pending" | "failed" | "expired" | null = null;
  let reason: string | null = null;
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) {
    session = sessionData(event);
    result = event.type === "checkout.session.async_payment_failed"
      ? "failed"
      : event.type === "checkout.session.expired"
        ? "expired"
        : event.type === "checkout.session.completed" && session.payment_status !== "paid"
          ? "pending"
          : "success";
    reason = result === "expired" ? "Stripe checkout session expired" : result === "failed" ? "Stripe payment failed" : null;
  }

  if (!session || !result) return Response.json({ received: true });
  const attemptId = session.metadata?.payment_attempt_id;
  if (!attemptId) return Response.json({ received: true });
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const { error } = await serviceClient().rpc("cms_record_stripe_webhook", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_attempt_id: attemptId,
    p_session_id: session.id,
    p_payment_intent_id: paymentIntent,
    p_result: result,
    p_reason: reason,
  });
  if (error) return Response.json({ error: "Payment event could not be recorded" }, { status: 500 });
  return Response.json({ received: true });
}
