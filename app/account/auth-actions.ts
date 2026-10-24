"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionClient } from "../../lib/supabase/server";
import { safeAccountNext } from "../../lib/account/safe-next";
type AuthState = { error?: string; message?: string; verificationRequired?: boolean };

async function callbackUrl() {
  const origin = (await headers()).get("origin");
  const allowed = new Set([
    "http://localhost:3102", "http://localhost:3000", "http://localhost:3101",
    "https://binder-finders.vercel.app", "https://www.binderfinders.com", "https://binderfinders.com",
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]);
  if (!origin || !allowed.has(origin)) throw new Error("Unrecognized account origin");
  return `${origin}/account/callback`;
}

function withNext(path: string, next: string) {
  return next === "/account"
    ? path
    : `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}

export async function authenticateCustomer(mode: string, _previous: AuthState, form: FormData): Promise<AuthState> {
  let destination = "";
  try {
    const db = await sessionClient();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const next = safeAccountNext(form.get("next"));
    if (mode !== "reset-password" && !z.string().email().max(200).safeParse(email).success)
      return { error: "Enter a valid email address." };
    if ((mode === "signup" || mode === "reset-password") && (password.length < 12 || password.length > 256))
      return { error: "Use a password between 12 and 256 characters." };
    const callback = await callbackUrl();
    if (mode === "signup") {
      const name = String(form.get("name") || "").trim();
      if (!name || name.length > 120) return { error: "Enter your name (up to 120 characters)." };
      const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: withNext(callback, next), data: { name } } });
      if (error) return { error: emailError(error) };
      const jar = await cookies();
      jar.set("customer-pending-email", email, { httpOnly: true, sameSite: "lax", secure: callback.startsWith("https:"), path: "/account", maxAge: 1800 });
      destination = data.session && data.user?.email_confirmed_at ? next : withNext("/account/verify", next);
    } else if (mode === "login") {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error?.code === "email_not_confirmed" || (!error && !data.user?.email_confirmed_at)) {
        (await cookies()).set("customer-pending-email", email, { httpOnly: true, sameSite: "lax", secure: callback.startsWith("https:"), path: "/account", maxAge: 1800 });
        return { error: "Verify your email before signing in. Check your inbox or request a new confirmation email.", verificationRequired: true };
      }
      if (error) return { error: error.status === 429 ? "Too many sign-in attempts. Please wait a few minutes and try again." : "The email or password is incorrect. Please try again." };
      destination = next;
    } else if (mode === "forgot-password") {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: withNext(`${callback}?flow=recovery`, next) });
      if (error) return { error: emailError(error) };
      destination = withNext("/account/reset-sent", next);
    } else if (mode === "verify") {
      const { error } = await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: withNext(callback, next) } });
      if (error) return { error: emailError(error) };
      return { message: "If this account needs verification, a new link is on its way. Use the newest email in this browser." };
    } else if (mode === "reset-password") {
      if (password !== form.get("confirm")) return { error: "Your passwords do not match." };
      const { data: { user } } = await db.auth.getUser();
      if (!user) return { error: "Your session has expired. Request a new password-reset link." };
      const { error } = await db.auth.updateUser({ password });
      if (error) return { error: "Unable to update your password. Choose a different password or request a fresh link." };
      destination = next;
    } else return { error: "Unknown account action." };
  } catch { return { error: "We couldn't connect to the account service. Please try again." }; }
  redirect(destination);
}
function emailError(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return "Too many email requests. Please wait a few minutes before trying again.";
  if (error.code === "email_address_not_authorized" || error.code === "unexpected_failure") return "Email delivery is currently unavailable. Please contact the store or try again later.";
  return "We couldn't send the account email. Please try again later, or sign in if you already have an account.";
}
