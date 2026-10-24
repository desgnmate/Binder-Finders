import { redirect } from "next/navigation";
import { sessionClient } from "../../lib/supabase/server";
import { AccountOverview, type RecentHold } from "../../components/account/AccountOverview";
export default async function AccountPage() {
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/account/login");
  if (!user.email_confirmed_at) redirect("/account/verify");
  const [profile, recent, total, active, completed] = await Promise.all([
    db.from("customer_profiles").select("name").eq("user_id", user.id).maybeSingle(),
    db.from("hold_requests").select("id,status,currency,created_at,hold_request_items(card_id,name,price_cents)").eq("customer_user_id", user.id).order("created_at", { ascending: false }).limit(4),
    db.from("hold_requests").select("id", { count: "exact", head: true }).eq("customer_user_id", user.id),
    db.from("hold_requests").select("id", { count: "exact", head: true }).eq("customer_user_id", user.id).in("status", ["pending", "accepted"]),
    db.from("hold_requests").select("id", { count: "exact", head: true }).eq("customer_user_id", user.id).eq("status", "completed"),
  ]);
  return <AccountOverview
    name={profile.data?.name || String(user.user_metadata.name || "Collector")}
    email={user.email || ""}
    profileUnavailable={!!profile.error}
    holds={(recent.data || []) as RecentHold[]}
    ordersUnavailable={!!recent.error}
    counts={{ total: total.error ? null : total.count ?? 0, active: active.error ? null : active.count ?? 0, completed: completed.error ? null : completed.count ?? 0 }}
  />;
}
