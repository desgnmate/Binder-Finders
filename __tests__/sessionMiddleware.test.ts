/** @jest-environment node */
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const mockCreate = jest.fn();
jest.mock("@supabase/ssr", () => ({ createServerClient: (...args: unknown[]) => mockCreate(...args) }));

it("passes renewed cookies to both the server page and the browser", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  const request = new NextRequest("https://binder-finders.vercel.app/checkout", { headers: { Cookie: "sb-test-auth-token=old" } });
  const mockClaims = jest.fn();
  mockCreate.mockImplementation((_url, _key, options) => {
    mockClaims.mockImplementation(async () => {
      expect(options.cookies.getAll()).toEqual([{ name: "sb-test-auth-token", value: "old" }]);
      options.cookies.setAll([{ name: "sb-test-auth-token", value: "renewed", options: { path: "/", maxAge: 34560000, sameSite: "lax" } }]);
      return { data: { claims: { sub: "customer" } }, error: null };
    });
    return { auth: { getClaims: mockClaims } };
  });
  try {
    const response = await middleware(request);
    expect(mockClaims).toHaveBeenCalledTimes(1);
    expect(request.cookies.get("sb-test-auth-token")?.value).toBe("renewed");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("renewed");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=34560000");
    expect(response.headers.get("cache-control")).toContain("no-store");
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
