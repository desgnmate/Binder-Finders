import Link from "next/link";
export default function LinkError() {
  return <><h1>Let’s get a fresh link</h1><p>This link has expired, was already used, or was opened in a different browser. Open your latest email in the browser where you made the request.</p><div className="customer-links"><Link href="/account/verify">Resend verification</Link><Link href="/account/forgot-password">Reset password</Link><Link href="/account/login">Sign in</Link></div></>;
}
