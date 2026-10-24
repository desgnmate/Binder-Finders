/** @jest-environment node */
import { authenticateCustomer } from "../../../app/account/auth-actions";
const mockAuth = { signUp: jest.fn(), resetPasswordForEmail: jest.fn(), updateUser: jest.fn(), getUser: jest.fn(), signInWithPassword: jest.fn(), resend: jest.fn() };
const mockSet = jest.fn();
jest.mock("../../../lib/supabase/server", () => ({ sessionClient: async () => ({ auth: mockAuth }) }));
jest.mock("next/headers", () => ({ headers: async () => new Map([["origin", "http://localhost:3102"]]), cookies: async () => ({ set: mockSet }) }));
jest.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ name: "Collector", email: "collector@example.test", password: "long-test-password", ...values }).forEach(([k,v]) => data.set(k,v));
  return data;
}
beforeEach(() => jest.resetAllMocks());
it("redirects signup to verification and keeps email out of the URL", async () => {
  mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await expect(authenticateCustomer("signup", {}, form())).rejects.toThrow("REDIRECT:/account/verify");
  expect(mockAuth.signUp).toHaveBeenCalledWith({ email: "collector@example.test", password: "long-test-password", options: { emailRedirectTo: "http://localhost:3102/account/callback", data: { name: "Collector" } } });
  expect(mockSet).toHaveBeenCalledWith("customer-pending-email", "collector@example.test", expect.objectContaining({ httpOnly: true }));
});
it("does not show success when email sending fails", async () => {
  mockAuth.signUp.mockResolvedValue({ error: { code: "email_address_not_authorized" } });
  expect(await authenticateCustomer("signup", {}, form())).toEqual({ error: expect.stringContaining("Email delivery is currently unavailable") });
  expect(mockSet).not.toHaveBeenCalled();
});
it("rejects weak passwords on the server", async () => {
  expect(await authenticateCustomer("signup", {}, form({ password: "short" }))).toEqual({ error: expect.stringContaining("12") });
  expect(mockAuth.signUp).not.toHaveBeenCalled();
});
it("sends recovery to customer callback and redirects to confirmation", async () => {
  mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
  await expect(authenticateCustomer("forgot-password", {}, form())).rejects.toThrow("REDIRECT:/account/reset-sent");
  expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith("collector@example.test", { redirectTo: "http://localhost:3102/account/callback?flow=recovery" });
});
it("blocks mismatched passwords and expired sessions", async () => {
  expect(await authenticateCustomer("reset-password", {}, form({ confirm: "different" }))).toEqual({ error: "Your passwords do not match." });
  mockAuth.getUser.mockResolvedValue({ data: { user: null } });
  expect(await authenticateCustomer("reset-password", {}, form({ confirm: "long-test-password" }))).toEqual({ error: expect.stringContaining("expired") });
  expect(mockAuth.updateUser).not.toHaveBeenCalled();
});
it("takes verified customers to their account", async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-22" } }, error: null });
  await expect(authenticateCustomer("login", {}, form())).rejects.toThrow("REDIRECT:/account");
});
it("returns customers to checkout after signing in", async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-22" } }, error: null });
  await expect(authenticateCustomer("login", {}, form({ next: "/checkout" }))).rejects.toThrow("REDIRECT:/checkout");
});
it("preserves a safe checkout destination in the verification callback", async () => {
  mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await expect(authenticateCustomer("signup", {}, form({ next: "/checkout" }))).rejects.toThrow("REDIRECT:/account/verify?next=%2Fcheckout");
  expect(mockAuth.signUp).toHaveBeenCalledWith({ email: "collector@example.test", password: "long-test-password", options: { emailRedirectTo: "http://localhost:3102/account/callback?next=%2Fcheckout", data: { name: "Collector" } } });
});
it("keeps unverified customers out of account", async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed" } });
  expect(await authenticateCustomer("login", {}, form())).toEqual({ error: expect.stringContaining("Verify your email"), verificationRequired: true });
  expect(mockSet).toHaveBeenCalledWith("customer-pending-email", "collector@example.test", expect.objectContaining({ httpOnly: true }));
});
it("does not offer verification for an incorrect password", async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
  expect(await authenticateCustomer("login", {}, form())).toEqual({ error: expect.stringContaining("incorrect") });
  expect(mockSet).not.toHaveBeenCalled();
});
it("ignores a crafted external return destination on login", async () => {
  mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-09-22" } }, error: null });
  await expect(authenticateCustomer("login", {}, form({ next: "/\\example.test" }))).rejects.toThrow("REDIRECT:/account");
});
