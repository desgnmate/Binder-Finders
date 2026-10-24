import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionClient } from "../../../lib/supabase/server";
import { CustomerProfileForm } from "../../../components/account/CustomerProfileForm";
import { Check, LockKeyhole } from "lucide-react";

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

  const displayName = profile?.name || String(user.user_metadata.name || "");

  return (
    <section className="ac-panel ac-panel--pink" aria-labelledby="profile-heading">
      <header className="ac-head">
        <div className="ac-head__text">
          <span className="ac-px">Trainer settings</span>
          <h1 id="profile-heading">Profile &amp; security</h1>
          <p>Keep your collector details up to date and your account secure.</p>
        </div>
      </header>

      <div className="ac-profile">
        <section className="ac-notebook" aria-labelledby="details-heading">
          <div className="ac-rings" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <div className="ac-notebook__body">
            <div className="ac-profile__title">
              <span className="ac-badge" aria-hidden="true">
                {(displayName.trim()[0] || "C").toUpperCase()}
              </span>
              <div>
                <h2 id="details-heading">Personal details</h2>
                <p className="ac-muted">This is the name we&apos;ll use for your account.</p>
              </div>
            </div>
            {error ? (
              <p className="customer-message" role="alert">
                Profile details are temporarily unavailable. Please try again later.
              </p>
            ) : (
              <CustomerProfileForm name={displayName} />
            )}
          </div>
        </section>

        <section className="ac-card ac-security" aria-labelledby="security-heading">
          <div className="ac-profile__title">
            <span className="ac-badge ac-badge--blue" aria-hidden="true">
              <LockKeyhole size={28} strokeWidth={2.4} />
            </span>
            <h2 id="security-heading">Sign-in &amp; security</h2>
          </div>
          <div className="ac-email">
            <span className="ac-px ac-muted">Your verified email address</span>
            <span>
              <strong>{user.email}</strong>
              <span className="ac-chip" data-tone="done">
                <Check size={12} strokeWidth={3.4} aria-hidden="true" /> Verified
              </span>
            </span>
          </div>
          <p>To change your password, request a secure reset link by email.</p>
          <Link className="ac-btn" style={{ alignSelf: "flex-start" }} href="/account/forgot-password">
            Reset password
          </Link>
        </section>
      </div>
    </section>
  );
}
