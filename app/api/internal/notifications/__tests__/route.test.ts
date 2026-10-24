/** @jest-environment node */
import { GET } from "../route";
const mockRpc = jest.fn();
jest.mock("../../../../../lib/supabase/server", () => ({ serviceClient: () => ({ rpc: mockRpc }) }));
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const body = { from: "sender@example.test", to: ["buyer@example.test"], subject: "Receipt", text: "Hello" };
const row = { id: 42, claim_token: "test-lease", kind: "customer_request_received", to_email: "buyer@example.test", delivery_body: body };
let mockFetch: jest.Mock;
function request(authorized = true) {
  return new Request("https://local.test/api/internal/notifications", { headers: authorized ? { authorization: "Bearer test-only" } : {} });
}
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CRON_SECRET = "test-only";
  process.env.RESEND_API_KEY = "test-only";
  process.env.RESEND_FROM_EMAIL = "sender@example.test";
  mockFetch = jest.fn().mockResolvedValue({ ok: true });
  global.fetch = mockFetch;
  mockRpc.mockImplementation(async (name) => {
    if (name === "cms_expire_unpaid_holds") return { data: 0, error: null };
    if (name === "cms_claim_notification_outbox") return { data: [row], error: null };
    return { data: true, error: null };
  });
});
afterAll(() => { global.fetch = originalFetch; process.env = originalEnv; });
it("rejects unauthorized calls without claiming or sending", async () => {
  expect((await GET(request(false))).status).toBe(401);
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
});
it("leaves queue untouched when mail is not configured", async () => {
  delete process.env.RESEND_API_KEY;
  expect((await GET(request())).status).toBe(503);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith("cms_expire_unpaid_holds", { p_limit: 50 });
  expect(mockFetch).not.toHaveBeenCalled();
});
it("uses a stable provider key, frozen body, timeout and fenced acknowledgement", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ expired: 0, paymentReconciliation: { reconciled: 0, errors: 0 }, claimed: 1, sent: 1, failed: 0, acknowledgementFailed: 0 });
  expect(mockFetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
    body: JSON.stringify(body), signal: expect.any(AbortSignal), headers: expect.objectContaining({ "Idempotency-Key": "binderfinders-notification-42" }),
  }));
  expect(mockRpc).toHaveBeenCalledWith("cms_finish_notification", { p_id: 42, p_claim_token: "test-lease", p_success: true, p_error: null });
});
it.each([{ error: { message: "db failed" } }, { data: false, error: null }])("does not claim success when acknowledgement fails: %j", async (finish) => {
  mockRpc.mockImplementation(async (name) => {
    if (name === "cms_expire_unpaid_holds") return { data: 0, error: null };
    return name === "cms_claim_notification_outbox" ? { data: [row], error: null } : finish;
  });
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ expired: 0, paymentReconciliation: { reconciled: 0, errors: 0 }, claimed: 1, sent: 0, failed: 0, acknowledgementFailed: 1 });
  expect(mockRpc).toHaveBeenCalledTimes(3);
});
it("records provider errors without reporting delivery success", async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 429 });
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect((await response.json()).failed).toBe(1);
  expect(mockRpc).toHaveBeenLastCalledWith("cms_finish_notification", expect.objectContaining({ p_success: false, p_error: "Email provider returned 429" }));
});
it("records timeout as an ambiguous failure safe to retry", async () => {
  mockFetch.mockRejectedValue(new Error("Timed out"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect((await response.json()).sent).toBe(0);
});
it("refuses to send without a lease", async () => {
  mockRpc.mockResolvedValue({ data: [{ ...row, claim_token: null }], error: null });
  expect((await GET(request())).status).toBe(503);
  expect(mockFetch).not.toHaveBeenCalled();
});
it("freezes a newly rendered email before sending", async () => {
  mockRpc.mockImplementation(async (name) => {
    if (name === "cms_expire_unpaid_holds") return { data: 0, error: null };
    if (name === "cms_claim_notification_outbox") return { data: [{ ...row, delivery_body: null, payload: { reference: "ABC", name: "Buyer", email: "buyer@example.test", status: "pending", currency: "AUD", totalCents: 1000, items: [] } }], error: null };
    if (name === "cms_prepare_notification") return { data: body, error: null };
    return { data: true, error: null };
  });
  expect((await GET(request())).status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith("cms_prepare_notification", expect.objectContaining({ p_id: 42, p_claim_token: "test-lease", p_body: expect.objectContaining({ subject: expect.stringContaining("ABC") }) }));
  expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify(body) }));
});
