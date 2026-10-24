import "server-only";
import { serviceClient } from "./supabase/server";
import { stripeClient, stripePaymentsConfigured } from "./stripe";

// The cron checks Stripe before releasing inventory at a hold's deadline.
// Ambiguous payments remain reserved and are retried on the next run.
export async function reconcileDueStripeAttempts(db: ReturnType<typeof serviceClient>) {
  if (!stripePaymentsConfigured()) return { reconciled: 0, errors: 0 };
  // Bound Stripe calls to leave time for hold expiry and email work inside
  // the scheduled function's 60-second budget.
  const { data, error } = await db.rpc("cms_due_stripe_attempts", { p_limit: 5 });
  if (error) throw new Error("Stripe payment reconciliation is unavailable");

  const stripe = stripeClient();
  let reconciled = 0;
  let errors = 0;
  for (const attempt of data || []) {
    try {
      if (!attempt.session_id) {
        const result = await db.rpc("cms_fail_stripe_payment", {
          p_attempt_id: attempt.attempt_id,
          p_status: "failed",
          p_reason: "Checkout session was not created before the hold deadline",
        });
        if (result.error || result.data !== true) throw new Error("Could not close unfinished payment");
        reconciled += 1;
        continue;
      }

      let session = await stripe.checkout.sessions.retrieve(attempt.session_id);
      if (session.status === "open") {
        // An open session may still accept payment. Expire it at Stripe first.
        try {
          session = await stripe.checkout.sessions.expire(session.id);
        } catch {
          // The customer may have completed Checkout concurrently. Re-read
          // its authoritative status instead of releasing the reserved card.
          session = await stripe.checkout.sessions.retrieve(session.id);
        }
      }

      if (session.status === "expired") {
        const result = await db.rpc("cms_fail_stripe_payment", {
          p_attempt_id: attempt.attempt_id,
          p_status: "expired",
          p_reason: "Stripe checkout session expired",
        });
        if (result.error || result.data !== true) throw new Error("Could not record expired payment");
        reconciled += 1;
      } else if (session.status === "complete" && session.payment_status === "paid") {
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
        const result = await db.rpc("cms_record_stripe_webhook", {
          p_event_id: `reconcile_${session.id}`,
          p_event_type: "checkout.session.reconciled",
          p_attempt_id: attempt.attempt_id,
          p_session_id: session.id,
          p_payment_intent_id: paymentIntent,
          p_result: "success",
          p_reason: null,
        });
        if (result.error || result.data !== true) throw new Error("Could not record completed payment");
        reconciled += 1;
      }
      // A complete but unpaid session may settle asynchronously; retain the
      // hold until Stripe sends the success/failure webhook.
    } catch {
      errors += 1;
    }
  }
  return { reconciled, errors };
}
