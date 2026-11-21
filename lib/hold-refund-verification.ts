import "server-only";
import { stripeClient } from "./stripe";

export type VerifiedHoldRefund = {
  refundIds: string[];
  refundedCents: number;
};

export async function verifyHoldFullRefund(
  paymentIntentId: string,
  expectedCents: number,
  expectedCurrency: string,
): Promise<VerifiedHoldRefund> {
  const currency = expectedCurrency.trim().toLowerCase();

  if (
    !paymentIntentId.startsWith("pi_") ||
    !Number.isSafeInteger(expectedCents) ||
    expectedCents <= 0 ||
    !/^[a-z]{3}$/.test(currency)
  ) {
    throw new Error("Invalid payment verification details");
  }

  const stripe = stripeClient();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (
    intent.id !== paymentIntentId ||
    intent.status !== "succeeded" ||
    intent.currency !== currency ||
    intent.amount_received !== expectedCents
  ) {
    throw new Error("Stripe payment does not match the recorded Hold");
  }

  const refundIds: string[] = [];
  let refundedCents = 0;
  let startingAfter: string | undefined;
  let fullyPaginated = false;

  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const page = await stripe.refunds.list({
      payment_intent: paymentIntentId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const refund of page.data) {
      if (refund.payment_intent !== paymentIntentId) {
        throw new Error("Refund belongs to a different payment");
      }

      if (refund.status !== "succeeded") continue;

      if (refund.currency !== currency) {
        throw new Error("Refund currency mismatch");
      }

      refundedCents += refund.amount;
      refundIds.push(refund.id);

      if (
        !Number.isSafeInteger(refundedCents) ||
        refundedCents > expectedCents
      ) {
        throw new Error("Refund amount exceeds original payment");
      }
    }

    if (!page.has_more) {
      fullyPaginated = true;
      break;
    }

    const lastRefund = page.data[page.data.length - 1];

    if (!lastRefund) {
      throw new Error("Incomplete Stripe refund pagination");
    }

    startingAfter = lastRefund.id;
  }

  if (
    !fullyPaginated ||
    refundIds.length === 0 ||
    new Set(refundIds).size !== refundIds.length ||
    refundedCents !== expectedCents
  ) {
    throw new Error("A complete successful Stripe refund was not verified");
  }

  return { refundIds, refundedCents };
}