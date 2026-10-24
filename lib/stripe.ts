import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function stripePaymentsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe payments are not configured");
  client ??= new Stripe(secret);
  return client;
}
