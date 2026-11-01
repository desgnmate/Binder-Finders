// Stripe refuses card charges below a per-currency minimum. Amounts here are
// in the store's minor units (price × 100), which for JPY means ¥50 = 5000.
const minimumCents: Record<string, number> = { gbp: 30, jpy: 5000 };

export const belowMinimumMessage =
  "This order total is below the minimum for card payments. Please contact the store to arrange payment.";

export function cardPaymentMinimumCents(currency: string) {
  return minimumCents[currency.toLowerCase()] ?? 50;
}

export function belowCardPaymentMinimum(currency: string, totalCents: number) {
  return totalCents < cardPaymentMinimumCents(currency);
}

// Stripe expects zero-decimal currencies (JPY) in whole units, while the
// store keeps every currency as price × 100.
const zeroDecimal = new Set(["jpy"]);

export function stripeUnitAmount(currency: string, storeCents: number) {
  return zeroDecimal.has(currency.toLowerCase()) ? Math.round(storeCents / 100) : storeCents;
}
