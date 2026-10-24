import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionClient } from "../../../lib/supabase/server";
import { CustomerProfileForm } from "../../../components/account/CustomerProfileForm";

export const metadata = { title: "Profile & security | BinderFinders" };

export default async function CustomerProfilePage() {
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/account/login?next=/account/profile");
  if (!user.email_confirmed_at) redirect("/account/verify?next=/account/profile");
  const { data: profile, error } = await db
    .from("customer_profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <header className="account-page-header">
        <h1>Profile & security</h1>
        <p className="account-page-subtitle">
          Keep your collector details up to date and your account secure.
        </p>
      </header>

      <div className="account-profile-grid">
        <section className="account-panel">
          <h2>Personal details</h2>
          <p>This is the name we&apos;ll use for your account.</p>
          {error ? (
            <p className="customer-message" role="alert">
              Profile details are temporarily unavailable. Please try again later.
            </p>
          ) : (
            <CustomerProfileForm
              name={profile?.name || String(user.user_metadata.name || "")}
            />
          )}
        </section>

        <section className="account-panel">
          <h2>Sign-in & security</h2>
          <p>Your verified email address</p>
          <strong className="account-email">{user.email}</strong>
          <p>To change your password, request a secure reset link by email.</p>
          <Link
            className="account-button account-button-secondary"
            href="/account/forgot-password"
          >
            Reset password
          </Link>
        </section>
      </div>
    </>
  );
}
