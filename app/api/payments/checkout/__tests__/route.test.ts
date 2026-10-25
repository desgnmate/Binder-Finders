/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";
const mockRpc = jest.fn();
const mockSingle = jest.fn();
const mockGetUser = jest.fn();
const mockStripe = { checkout: { sessions: { create: jest.fn(), retrieve: jest.fn(), expire: jest.fn() } } };
jest.mock("../../../../../lib/supabase/server", () => ({
  serviceClient: () => ({ rpc: mockRpc, from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }) }),
  sessionClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
jest.mock("../../../../../lib/stripe", () => ({ stripeClient: () => mockStripe, stripePaymentsConfigured: () => true }));
const originalEnv = { ...process.env };
const holdId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const idempotencyKey = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const created = { state: "create", attemptId, sessionId: null, holdId, customerEmail: "buyer@example.test", currency: "aud", amountCents: 1250, items: [{ name: "Charizard", priceCents: 1250 }] };
function request(origin = "https://local.test") {
  return new NextRequest("https://local.test/api/payments/checkout", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ holdId, idempotencyKey }),
  });
}
function rpcs(begin: unknown, attach: unknown = { data: true, error: null }) {
  mockRpc.mockImplementation(async (name) => {
    if (name === "cms_begin_stripe_payment") return begin;
    if (name === "cms_attach_stripe_session") return attach;
    return { data: true, error: null };
  });
}
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CMS_ENABLED = "true";
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email_confirmed_at: "2026-10-01" } }, error: null });
  mockSingle.mockResolvedValue({ data: { expires_at: new Date(Date.now() + 2 * 3600_000).toISOString() }, error: null });
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: "cs_test_new", url: "https://checkout.stripe.test/new", status: "open" });
  mockStripe.checkout.sessions.expire.mockResolvedValue({});
});
afterAll(() => { process.env = originalEnv; });
it("rejects cross-origin requests", async () => {
  expect((await POST(request("https://evil.test"))).status).toBe(403);
  expect(mockRpc).not.toHaveBeenCalled();
});
it("requires a verified customer", async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email_confirmed_at: null } }, error: null });
  expect((await POST(request())).status).toBe(401);
});
it("creates a session from server-side prices and attaches it", async () => {
  rpcs({ data: created, error: null });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/new" });
  expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
    line_items: [expect.objectContaining({ price_data: expect.objectContaining({ currency: "aud", unit_amount: 1250 }) })],
    metadata: { hold_id: holdId, payment_attempt_id: attemptId },
  }), { idempotencyKey: `binderfinders-payment-${idempotencyKey}` });
  expect(mockRpc).toHaveBeenCalledWith("cms_attach_stripe_session", { p_attempt_id: attemptId, p_session_id: "cs_test_new" });
});
it("reuses an open session instead of creating another", async () => {
  rpcs({ data: { ...created, state: "existing", sessionId: "cs_test_open" }, error: null });
  mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_test_open", status: "open", url: "https://checkout.stripe.test/open" });
  const response = await POST(request());
  expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/open" });
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalledWith("cms_fail_stripe_payment", expect.anything());
});
it("expires the Stripe session when it cannot be attached", async () => {
  rpcs({ data: created, error: null }, { data: false, error: null });
  expect((await POST(request())).status).toBe(502);
  expect(mockStripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_test_new");
  expect(mockRpc).toHaveBeenCalledWith("cms_fail_stripe_payment", expect.objectContaining({ p_attempt_id: attemptId, p_status: "failed" }));
});
it("returns a retryable conflict for a finished attempt key", async () => {
  rpcs({ data: null, error: { message: "This payment session has expired. Start payment again from the order." } });
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect((await response.json()).error).toMatch(/expired/);
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});
it("refuses to start Checkout that would outlive the hold", async () => {
  rpcs({ data: created, error: null });
  mockSingle.mockResolvedValue({ data: { expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }, error: null });
  expect((await POST(request())).status).toBe(409);
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});
it("explains a zero total instead of a generic failure", async () => {
  rpcs({ data: null, error: { message: 'new row for relation "payment_attempts" violates check constraint "payment_attempts_amount_cents_check"' } });
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect((await response.json()).error).toMatch(/below the minimum for card payments/);
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});
it("does not send a total below Stripe's minimum to Checkout", async () => {
  rpcs({ data: { ...created, amountCents: 20, items: [{ name: "Energy", priceCents: 20 }] }, error: null });
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect((await response.json()).error).toMatch(/below the minimum for card payments/);
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledWith("cms_fail_stripe_payment", expect.objectContaining({
    p_attempt_id: attemptId,
    p_reason: "Order total is below the card payment minimum",
  }));
});
