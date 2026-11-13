/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";
const mockRpc = jest.fn();
const mockGetUser = jest.fn();
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));
jest.mock("../../../../lib/supabase/server", () => ({
  serviceClient: () => ({ rpc: mockRpc }),
  sessionClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
const originalEnv = { ...process.env };
const body = {
  name: "Ash", email: "victim@example.test", note: "", cardIds: ["charizard-base1"],
  prices: { "charizard-base1": 1250 }, requestKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", website: "",
};
function request() {
  return new NextRequest("https://local.test/api/holds", {
    method: "POST", headers: { origin: "https://local.test", "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CMS_ENABLED = "true";
  process.env.SUPABASE_SECRET_KEY = "test-only";
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "Ash@Example.test", email_confirmed_at: "2026-10-01" } }, error: null });
  mockRpc.mockResolvedValue({ data: "hold-1", error: null });
});
afterAll(() => { process.env = originalEnv; });
it("sends hold emails to the verified account, not the typed address", async () => {
  expect((await POST(request())).status).toBe(201);
  expect(mockRpc).toHaveBeenCalledWith("cms_submit_hold", expect.objectContaining({
    p_request: expect.objectContaining({ email: "ash@example.test" }),
    p_customer_user_id: "user-1",
  }));
});

it("passes the delivery address to the database", async () => {
  const delivery = { method: "post", recipient: "Ash", line1: "1 Pallet St", suburb: "Fitzroy", state: "VIC", postcode: "3065" };
  const req = new NextRequest("https://local.test/api/holds", {
    method: "POST", headers: { origin: "https://local.test", "content-type": "application/json" }, body: JSON.stringify({ ...body, delivery }),
  });
  expect((await POST(req)).status).toBe(201);
  expect(mockRpc).toHaveBeenCalledWith("cms_submit_hold", expect.objectContaining({
    p_request: expect.objectContaining({ delivery: expect.objectContaining({ ...delivery, line2: "", phone: "" }) }),
  }));
});
it("rejects an incomplete address", async () => {
  const req = new NextRequest("https://local.test/api/holds", {
    method: "POST", headers: { origin: "https://local.test", "content-type": "application/json" },
    body: JSON.stringify({ ...body, delivery: { method: "post", recipient: "Ash", line1: "", suburb: "Fitzroy", state: "VIC", postcode: "30" } }),
  });
  expect((await POST(req)).status).toBe(400);
  expect(mockRpc).not.toHaveBeenCalled();
});
