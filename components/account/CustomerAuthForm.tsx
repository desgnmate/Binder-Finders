"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { authenticateCustomer } from "../../app/account/auth-actions";
export type CustomerMode = "login" | "signup" | "forgot-password" | "reset-password" | "verify";
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="ac-btn ac-btn--yellow ac-btn--lg ac-btn--block" disabled={pending}>{pending ? "Please wait…" : label}</button>;
}
export function CustomerAuthForm({ mode, email = "", next }: { mode: CustomerMode; email?: string; next?: string }) {
  const [state, action] = useActionState(authenticateCustomer.bind(null, mode), {});
  const accountLink = (path: string) => next ? `${path}?next=${encodeURIComponent(next)}` : path;
  const title = { login: "Welcome back", signup: "Create your account", "forgot-password": "Forgot your password?", "reset-password": "Choose a new password", verify: "Check your email" }[mode];
  return <>
    {(mode === "login" || mode === "signup") && <nav className="ac-switch" aria-label="Account access">
      <Link href={accountLink("/account/login")} aria-current={mode === "login" ? "page" : undefined}>Sign in</Link>
      <Link href={accountLink("/account/signup")} aria-current={mode === "signup" ? "page" : undefined}>Create account</Link>
    </nav>}
    <h1>{title}</h1>
    <p>{mode === "signup" ? "Create an account for your BinderFinders purchases." : mode === "verify" ? "Open the latest verification email and select Confirm your email. Check your spam folder too. Already registered? Sign in below." : mode === "forgot-password" ? "We’ll email you a link to choose a new password." : mode === "reset-password" ? "Use a new password of at least 12 characters." : "Sign in to your BinderFinders account."}</p>
    {state.error && <div className="customer-message" role="alert"><div>{state.error}{state.verificationRequired && <p><Link className="ac-link" href={accountLink("/account/verify")}>Resend confirmation email</Link></p>}</div></div>}
    {state.message && <p className="customer-message" role="status">{state.message}</p>}
    <form action={action} className="ac-form">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && <label>Name<input name="name" autoComplete="name" required maxLength={120} /></label>}
      {mode !== "reset-password" && <label>Email address<input name="email" type="email" defaultValue={email} autoComplete="email" required maxLength={200} /></label>}
      {mode === "login" && <div className="ac-field">
        <span className="ac-form__label-row"><label htmlFor="customer-password">Password</label><Link className="ac-link" href={accountLink("/account/forgot-password")}>Forgot password?</Link></span>
        <input id="customer-password" name="password" type="password" autoComplete="current-password" minLength={1} required />
      </div>}
      {(mode === "signup" || mode === "reset-password") && <><label>{mode === "reset-password" ? "New password" : "Password"}<input name="password" type="password" autoComplete="new-password" minLength={12} required aria-describedby="password-help" /></label><small id="password-help">Use at least 12 characters.</small></>}
      {mode === "reset-password" && <label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" required minLength={12} /></label>}
      <SubmitButton label={{ login: "Sign in", signup: "Create account", "forgot-password": "Send reset link", "reset-password": "Save password", verify: "Resend verification email" }[mode]} />
    </form>
    {mode !== "login" && mode !== "signup" && <nav className="customer-links" aria-label="Account help">
      <Link href={accountLink("/account/login")}>Sign in</Link>
      {mode === "reset-password" && <Link href={accountLink("/account/forgot-password")}>Request a new reset link</Link>}
    </nav>}
  </>;
}
