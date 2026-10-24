import Link from "next/link";
export default function ResetSent() {
  return <><h1>Check your email</h1><p>If this email has an account, a password-reset link is on its way. Open the newest link in this browser to choose a new password.</p><p>Check your spam folder if it hasn’t arrived.</p><nav className="customer-links" aria-label="Account help"><Link href="/account/forgot-password">Send another link</Link><Link href="/account/login">Back to sign in</Link></nav></>;
}
