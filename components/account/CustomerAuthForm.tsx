"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { authenticateCustomer } from "../../app/account/auth-actions";
export type CustomerMode = "login" | "signup" | "forgot-password" | "reset-password" | "verify";
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Please wait…" : label}</button>;
}
export function CustomerAuthForm({ mode, email = "", next }: { mode: CustomerMode; email?: string; next?: string }) {
  const [state, action] = useActionState(authenticateCustomer.bind(null, mode), {});
  const accountLink = (path: string) => next ? `${path}?next=${encodeURIComponent(next)}` : path;
  const title = { login: "Welcome back", signup: "Create your account", "forgot-password": "Forgot your password?", "reset-password": "Choose a new password", verify: "Check your email" }[mode];
  return <><h1>{title}</h1>
    <p>{mode === "signup" ? "Create an account for your BinderFinders purchases." : mode === "verify" ? "Open the latest verification email and select Confirm your email. Check your spam folder too. Already registered? Sign in below." : mode === "forgot-password" ? "We’ll email you a link to choose a new password." : mode === "reset-password" ? "Use a new password of at least 12 characters." : "Sign in to your BinderFinders account."}</p>
    {state.error && <div className="customer-message" role="alert">{state.error}{state.verificationRequired && <p><Link href={accountLink("/account/verify")}>Resend confirmation email</Link></p>}</div>}
    {state.message && <p className="customer-message" role="status">{state.message}</p>}
    <form action={action}>
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && <label>Name<input name="name" autoComplete="name" required maxLength={120} /></label>}
      {mode !== "reset-password" && <label>Email address<input name="email" type="email" defaultValue={email} autoComplete="email" required maxLength={200} /></label>}
      {["login", "signup", "reset-password"].includes(mode) && <><label>{mode === "reset-password" ? "New password" : "Password"}<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 12} required aria-describedby={mode === "login" ? undefined : "password-help"} /></label>{mode !== "login" && <small id="password-help">Use at least 12 characters.</small>}</>}
      {mode === "reset-password" && <label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" required minLength={12} /></label>}
      <SubmitButton label={{ login: "Sign in", signup: "Create account", "forgot-password": "Send reset link", "reset-password": "Save password", verify: "Resend verification email" }[mode]} />
    </form>
    <nav className={`customer-links${mode === "login" ? " customer-login-actions" : ""}`} aria-label="Account help">
      {mode !== "login" && <Link href={accountLink("/account/login")}>Sign in</Link>}
      {mode === "login" && <><Link href={accountLink("/account/signup")}>Create an account</Link><Link href={accountLink("/account/forgot-password")}>Forgot password?</Link></>}
      {mode === "reset-password" && <Link href={accountLink("/account/forgot-password")}>Request a new reset link</Link>}
    </nav></>;
}
