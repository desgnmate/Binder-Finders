import "server-only";
import type Stripe from "stripe";
import { stripeUnitAmount } from "./cms/payments";
import { paymentSiteUrl } from "./payment-site-url";

export type GuestStripePayment = {
  attemptId: string;
  orderId: string;
  customerEmail: string;
  currency: string;
  items: { name: string; priceCents: number }[];
  shippingFeeCents: number;
  expiresAt: string;
};

export function guestStripeIdempotencyKey(paymentKey: string) {
  return `binderfinders-guest-${paymentKey}`;
}

export function guestStripeSessionParams(
  payment: GuestStripePayment,
): Stripe.Checkout.SessionCreateParams {
  const currency = payment.currency.toLowerCase();
  const expiresAt = new Date(payment.expiresAt).getTime();

  if (!Number.isFinite(expiresAt)) {
    throw new Error("Guest payment deadline is invalid");
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    payment.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: stripeUnitAmount(currency, item.priceCents),
        product_data: {
          name: item.name.slice(0, 250),
        },
      },
    }));

  if (payment.shippingFeeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: stripeUnitAmount(
          currency,
          payment.shippingFeeCents,
        ),
        product_data: { name: "Shipping" },
      },
    });
  }

  const baseUrl = paymentSiteUrl();
  const orderId = encodeURIComponent(payment.orderId);

  return {
    mode: "payment",
    payment_method_types: ["card"],
    expires_at: Math.floor(expiresAt / 1000),
    line_items: lineItems,
    customer_email: payment.customerEmail,
    client_reference_id: payment.orderId,
    metadata: {
      checkout_kind: "guest",
      guest_order_id: payment.orderId,
      guest_payment_attempt_id: payment.attemptId,
    },
    payment_intent_data: {
      metadata: {
        checkout_kind: "guest",
        guest_order_id: payment.orderId,
        guest_payment_attempt_id: payment.attemptId,
      },
    },
    success_url:
      `${baseUrl}/checkout?payment=success&guest_order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      `${baseUrl}/checkout?payment=cancelled&guest_order=${orderId}`,
  };
}

