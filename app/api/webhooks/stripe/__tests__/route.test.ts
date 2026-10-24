/** @jest-environment node */
import { POST } from "../route";
const mockRpc = jest.fn();
const mockConstructEvent = jest.fn();
jest.mock("../../../../../lib/supabase/server", () => ({ serviceClient: () => ({ rpc: mockRpc }) }));
jest.mock("../../../../../lib/stripe", () => ({ stripeClient: () => ({ webhooks: { constructEvent: mockConstructEvent } }) }));
const originalEnv = { ...process.env };
const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function request(signature: string | null = "t=1,v1=test") {
  return new Request("https://local.test/api/webhooks/stripe", { method: "POST", headers: signature ? { "stripe-signature": signature } : {}, body: "{}" });
}
function event(type: string, session: Record<string, unknown> = {}) {
  return { id: "evt_test_1", type, data: { object: { id: "cs_test_1", payment_status: "paid", payment_intent: "pi_test_1", metadata: { payment_attempt_id: attemptId }, ...session } } };
}
beforeEach(() => {
  jest.resetAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_only";
  mockRpc.mockResolvedValue({ data: true, error: null });
});
afterAll(() => { process.env = originalEnv; });
it("rejects unsigned and badly signed requests", async () => {
  expect((await POST(request(null))).status).toBe(503);
  mockConstructEvent.mockImplementation(() => { throw new Error("No signatures found"); });
  expect((await POST(request())).status).toBe(400);
  expect(mockRpc).not.toHaveBeenCalled();
});
it.each([
  ["checkout.session.completed", {}, "success", null],
  ["checkout.session.completed", { payment_status: "unpaid" }, "pending", null],
  ["checkout.session.async_payment_succeeded", {}, "success", null],
  ["checkout.session.async_payment_failed", {}, "failed", "Stripe payment failed"],
  ["checkout.session.expired", { payment_intent: null }, "expired", "Stripe checkout session expired"],
])("records %s as %s", async (type, session, result, reason) => {
  mockConstructEvent.mockReturnValue(event(type, session));
  expect((await POST(request())).status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith("cms_record_stripe_webhook", expect.objectContaining({
    p_event_id: "evt_test_1", p_event_type: type, p_attempt_id: attemptId, p_session_id: "cs_test_1", p_result: result, p_reason: reason,
  }));
});
it("acknowledges unrelated events and sessions without an attempt", async () => {
  mockConstructEvent.mockReturnValue(event("customer.created"));
  expect((await POST(request())).status).toBe(200);
  mockConstructEvent.mockReturnValue(event("checkout.session.completed", { metadata: {} }));
  expect((await POST(request())).status).toBe(200);
  expect(mockRpc).not.toHaveBeenCalled();
});
it("asks Stripe to retry when the event cannot be recorded", async () => {
  mockConstructEvent.mockReturnValue(event("checkout.session.completed"));
  mockRpc.mockResolvedValue({ data: null, error: { message: "db down" } });
  expect((await POST(request())).status).toBe(500);
});
