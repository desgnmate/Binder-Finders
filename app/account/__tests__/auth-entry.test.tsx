import AuthPage from "../[mode]/page";

const mockGetUser = jest.fn();
jest.mock("../../../lib/supabase/server", () => ({ sessionClient: async () => ({ auth: { getUser: mockGetUser } }) }));
jest.mock("next/headers", () => ({ cookies: async () => new Map() }));
jest.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error("not found"); } }));
jest.mock("../../../components/account/CustomerAuthForm", () => ({ CustomerAuthForm: () => null }));

beforeEach(() => jest.clearAllMocks());
it.each(["login", "signup", "verify"])("skips %s for a verified existing session and preserves checkout", async mode => {
  mockGetUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-23" } } });
  await expect(AuthPage({ params: Promise.resolve({ mode }), searchParams: Promise.resolve({ next: "/checkout" }) })).rejects.toThrow("redirect:/checkout");
});
it("keeps the login form accessible when signed out", async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  const result = await AuthPage({ params: Promise.resolve({ mode: "login" }), searchParams: Promise.resolve({}) });
  expect(result.props.mode).toBe("login");
});
it("keeps verification available to unverified users", async () => {
  mockGetUser.mockResolvedValue({ data: { user: { email_confirmed_at: null } } });
  const result = await AuthPage({ params: Promise.resolve({ mode: "verify" }), searchParams: Promise.resolve({}) });
  expect(result.props.mode).toBe("verify");
});
it("does not redirect a password recovery session away from its form", async () => {
  const result = await AuthPage({ params: Promise.resolve({ mode: "reset-password" }), searchParams: Promise.resolve({}) });
  expect(result.props.mode).toBe("reset-password");
  expect(mockGetUser).not.toHaveBeenCalled();
});
