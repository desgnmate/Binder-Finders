/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "../route";

const mockExchange = jest.fn();
jest.mock("../../../../lib/supabase/server", () => ({
  sessionClient: async () => ({ auth: { exchangeCodeForSession: mockExchange } }),
}));
beforeEach(() => mockExchange.mockResolvedValue({ error: null }));

it.each(["/\\example.test", "//example.test", "/\n/example.test"])(
  "blocks external callback redirects: %j", async (next) => {
    const result = await GET(new NextRequest(`https://binder-finders.vercel.app/account/callback?code=test&next=${encodeURIComponent(next)}`));
    expect(result.headers.get("location")).toBe("https://binder-finders.vercel.app/account");
  },
);
it("preserves checkout during password recovery", async () => {
  const result = await GET(new NextRequest("https://binder-finders.vercel.app/account/callback?code=test&flow=recovery&next=%2Fcheckout"));
  expect(result.headers.get("location")).toBe("https://binder-finders.vercel.app/account/reset-password?next=%2Fcheckout");
});
it("handles an expired confirmation code without signing in", async () => {
  mockExchange.mockResolvedValue({ error: { message: "expired" } });
  const result = await GET(new NextRequest("https://binder-finders.vercel.app/account/callback?code=test"));
  expect(result.headers.get("location")).toBe("https://binder-finders.vercel.app/account/link-error");
});
