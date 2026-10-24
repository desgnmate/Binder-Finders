"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient } from "../../lib/supabase/browser";
export function AuthForm({ mode = "login" }: { mode?: "login" | "reset" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(mode === "login");
  const [checkingSession, setCheckingSession] = useState(mode === "reset");
  useEffect(() => {
    if (mode !== "reset") return;
    const db = browserClient();
    const { data } = db.auth.onAuthStateChange((event, session) => {
      if (session) {
        setReady(true);
        setError("");
      }
    });
    let cancelled = false;
    async function initialiseSession() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        let sessionError: { message: string } | null = null;

        // Invitations and implicit recovery links return tokens in the
        // fragment. Persist them explicitly so SSR cookies can use the session.
        // Only this password-setup route accepts auth fragments. The presence
        // of both tokens is enough; some Supabase templates omit `type`.
        if (accessToken && refreshToken) {
          const result = await db.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          sessionError = result.error;
          if (!result.error) {
            window.history.replaceState(
              {},
              document.title,
              `${url.pathname}${url.search}`,
            );
          }
        } else {
          const code = url.searchParams.get("code");
          if (code) {
            const result = await db.auth.exchangeCodeForSession(code);
            sessionError = result.error;
            if (!result.error) {
              url.searchParams.delete("code");
              window.history.replaceState(
                {},
                document.title,
                `${url.pathname}${url.search ? `?${url.searchParams}` : ""}`,
              );
            }
          } else {
            const tokenHash = url.searchParams.get("token_hash");
            const tokenType = url.searchParams.get("type");
            if (
              tokenHash &&
              (tokenType === "invite" || tokenType === "recovery")
            ) {
              const result = await db.auth.verifyOtp({
                token_hash: tokenHash,
                type: tokenType,
              });
              sessionError = result.error;
              if (!result.error) {
                url.searchParams.delete("token_hash");
                url.searchParams.delete("type");
                window.history.replaceState(
                  {},
                  document.title,
                  `${url.pathname}${url.search ? `?${url.searchParams}` : ""}`,
                );
              }
            }
          }
        }

        if (cancelled) return;
        const { data: userData, error: userError } = await db.auth.getUser();
        if (userData.user) {
          setReady(true);
          setError("");
        } else if (sessionError || userError) {
          setError(
            "This invitation or password-reset link is invalid or expired. Request a new link and try again.",
          );
        } else {
          setError(
            "Open the latest invitation or password-reset link from your email.",
          );
        }
      } catch {
        if (!cancelled)
          setError(
            "This invitation or password-reset link is invalid or expired. Request a new link and try again.",
          );
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    void initialiseSession();
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [mode]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const db = browserClient();
      if (mode === "reset") {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        window.location.assign("/admin");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error)
          throw new Error(
            "The email or password is incorrect. Please try again.",
          );
        window.location.assign("/admin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await browserClient().auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/admin/reset-password` },
      );
      if (error) throw error;
      setNotice(
        "If this email has an account, a password reset link has been sent.",
      );
    } catch {
      setError("Unable to send the reset link. Please try again later.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cms-auth">
      <div className="cms-auth-box">
        <Link href="/">
          <img src="/images/logo.png" alt="BinderFinders" />
        </Link>
        <h1>{mode === "reset" ? "Set your password" : "Welcome back."}</h1>
        <p className="cms-muted">
          {mode === "reset"
            ? "Choose a strong password for your admin account."
            : "Sign in to manage your cards and store."}
        </p>
        {error && (
          <p role="alert" className="cms-notice cms-error">
            {error}
          </p>
        )}
        {mode === "reset" && !ready && !checkingSession && (
          <p className="cms-muted">
            <Link href="/admin/login">Request a fresh password-reset link</Link>
          </p>
        )}
        {notice && (
          <p role="status" className="cms-notice">
            {notice}
          </p>
        )}
        <form onSubmit={submit}>
          {mode === "login" && (
            <label className="cms-field">
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
          )}
          <label className="cms-field">
            {mode === "reset" ? "New password" : "Password"}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "reset" ? "new-password" : "current-password"
              }
              minLength={mode === "reset" ? 12 : 1}
              required
            />
          </label>
          {mode === "reset" && <small>Use at least 12 characters.</small>}
          <button
            className="cms-btn cms-btn-primary"
            disabled={
              busy ||
              (mode === "reset" &&
                (!ready || checkingSession || password.length < 12))
            }
          >
            {busy
              ? "Please wait…"
              : mode === "reset"
                ? "Save password"
                : "Sign in"}
          </button>
          {mode === "login" && (
            <button
              className="cms-btn"
              type="button"
              disabled={busy}
              onClick={reset}
            >
              Forgot password?
            </button>
          )}
        </form>
        <p>
          <Link href="/">← Back to the store</Link>
        </p>
      </div>
    </div>
  );
}
