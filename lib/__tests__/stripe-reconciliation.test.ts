/** @jest-environment node */
import { closeOpenCheckouts } from "../stripe-reconciliation";

jest.mock("server-only", () => ({}));
const mockRpc = jest.fn();
const mockAttempts = jest.fn();
const mockStripe = { checkout: { sessions: { retrieve: jest.fn(), expire: jest.fn() } } };
let mockConfigured = true;
jest.mock("../supabase/server", () => ({
  serviceClient: () => ({
    rpc: mockRpc,
    from: () => ({ select: () => ({ eq: () => ({ in: mockAttempts }) }) }),
  }),
}));
jest.mock("../stripe", () => ({
  stripeClient: () => mockStripe,
  stripePaymentsConfigured: () => mockConfigured,
}));

const holdId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  jest.resetAllMocks();
  mockConfigured = true;
  mockRpc.mockResolvedValue({ data: true, error: null });
});

it("does nothing when the hold has no open Checkout", async () => {
  mockAttempts.mockResolvedValue({ data: [], error: null });
  await closeOpenCheckouts(holdId);
  expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

it("expires an abandoned Checkout before the store cancels", async () => {
  mockAttempts.mockResolvedValue({ data: [{ id: "attempt-1", checkout_session_id: "cs_open" }], error: null });
  mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_open", status: "open" });
  mockStripe.checkout.sessions.expire.mockResolvedValue({ id: "cs_open", status: "expired" });
  await closeOpenCheckouts(holdId);
  expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_open");
  expect(mockRpc).toHaveBeenCalledWith("cms_fail_stripe_payment", expect.objectContaining({ p_attempt_id: "attempt-1", p_status: "expired" }));
});

it("records a payment that landed first and stops the cancel", async () => {
  mockAttempts.mockResolvedValue({ data: [{ id: "attempt-1", checkout_session_id: "cs_paid" }], error: null });
  mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_paid", status: "complete", payment_status: "paid", payment_intent: "pi_1" });
  await expect(closeOpenCheckouts(holdId)).rejects.toThrow(/just paid/);
  expect(mockRpc).toHaveBeenCalledWith("cms_record_stripe_webhook", expect.objectContaining({ p_result: "success", p_payment_intent_id: "pi_1" }));
});

it("keeps the hold while Stripe is still settling the payment", async () => {
  mockAttempts.mockResolvedValue({ data: [{ id: "attempt-1", checkout_session_id: "cs_async" }], error: null });
  mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_async", status: "complete", payment_status: "unpaid" });
  await expect(closeOpenCheckouts(holdId)).rejects.toThrow(/still confirming/);
  expect(mockRpc).not.toHaveBeenCalled();
});

it("cannot close Checkout without Stripe credentials", async () => {
  mockConfigured = false;
  mockAttempts.mockResolvedValue({ data: [{ id: "attempt-1", checkout_session_id: "cs_open" }], error: null });
  await expect(closeOpenCheckouts(holdId)).rejects.toThrow(/Payment is in progress/);
});
