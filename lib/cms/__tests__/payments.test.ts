import { belowCardPaymentMinimum } from "../payments";

it("applies Stripe's per-currency card minimums", () => {
  expect(belowCardPaymentMinimum("AUD", 0)).toBe(true);
  expect(belowCardPaymentMinimum("aud", 49)).toBe(true);
  expect(belowCardPaymentMinimum("AUD", 50)).toBe(false);
  expect(belowCardPaymentMinimum("GBP", 30)).toBe(false);
  expect(belowCardPaymentMinimum("JPY", 4900)).toBe(true);
});
