import "server-only";
import type Stripe from "stripe";
import { serviceClient } from "./supabase/server";
import { stripeClient, stripePaymentsConfigured } from "./stripe";

type Db = ReturnType<typeof serviceClient>;
type Attempt = { attempt_id: string; session_id: string | null };

/**
 * Close an unfinished payment attempt at Stripe and record the outcome.
 * Returns "paid" when the customer completed Checkout first, "pending" when
 * Stripe has not settled it yet, and "closed" when nothing can be paid.
 */
export async function settleStripeAttempt(db: Db, stripe: Stripe, attempt: Attempt, reason: string) {
  if (!attempt.session_id) {
    const result = await db.rpc("cms_fail_stripe_payment", {
      p_attempt_id: attempt.attempt_id,
      p_status: "failed",
      p_reason: reason,
    });
    if (result.error || result.data !== true) throw new Error("Could not close unfinished payment");
    return "closed" as const;
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
    return "closed" as const;
  }
  if (session.status === "complete" && session.payment_status === "paid") {
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
    return "paid" as const;
  }
  // A complete but unpaid session may settle asynchronously; retain the
  // hold until Stripe sends the success/failure webhook.
  return "pending" as const;
}

// The cron checks Stripe before releasing inventory at a hold's deadline.
// Ambiguous payments remain reserved and are retried on the next run.
export async function reconcileDueStripeAttempts(db: Db) {
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
      const outcome = await settleStripeAttempt(db, stripe, attempt, "Checkout session was not created before the hold deadline");
      if (outcome !== "pending") reconciled += 1;
    } catch {
      errors += 1;
    }
  }
  return { reconciled, errors };
}

/**
 * Before the store cancels or rejects a hold, close any Checkout the customer
 * left open so the cancellation is not blocked for up to a day.
 */
export async function closeOpenCheckouts(holdId: string, by: "store" | "customer" = "store") {
  const db = serviceClient();
  const { data, error } = await db
    .from("payment_attempts")
    .select("id,checkout_session_id")
    .eq("hold_id", holdId)
    .in("status", ["created", "open"]);
  if (error) throw new Error("Could not check this hold's payments. Please try again.");
  if (!data?.length) return;
  if (!stripePaymentsConfigured())
    throw new Error("Payment is in progress. Wait for checkout to finish before changing this hold.");
  const stripe = stripeClient();
  for (const row of data) {
    const outcome = await settleStripeAttempt(
      db,
      stripe,
      { attempt_id: row.id, session_id: row.checkout_session_id },
      by === "customer"
        ? "Checkout closed because you cancelled this hold"
        : "Checkout closed because the store cancelled this hold",
    );
    if (outcome === "paid")
      throw new Error(
        by === "customer"
          ? "Your payment has just gone through, so this hold can no longer be cancelled. Refresh the page."
          : "The customer has just paid for this hold. Refresh the request before changing it.",
      );
    if (outcome === "pending")
      throw new Error(
        by === "customer"
          ? "Stripe is still confirming your payment. Try again in a few minutes."
          : "Stripe is still confirming the customer's payment. Try again in a few minutes.",
      );
  }
}
