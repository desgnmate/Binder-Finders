import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../lib/supabase/server";
import {
  defaultSettings,
  fromRow,
  settingsSchema,
  type AdminCardSummary,
  type AdminDashboardStats,
  type CMSCard,
  type Collection,
  type Hold,
  type AuditEntry,
} from "../../lib/cms/types";
import type { AdminRequestTrend } from "../../components/admin/AdminOverview";
import { AdminConsole } from "../../components/admin/AdminConsole";
import { stripePaymentsConfigured } from "../../lib/stripe";
export const dynamic = "force-dynamic";

const views = [
  "dashboard",
  "cards",
  "collections",
  "holds",
  "content",
  "pokedex",
  "settings",
  "activity",
] as const;
type AdminView = (typeof views)[number];
const viewTitles: Record<AdminView, string> = {
  dashboard: "Overview",
  cards: "Cards",
  collections: "Collections",
  holds: "Hold requests",
  content: "Website content",
  pokedex: "Pokédex",
  settings: "Settings",
  activity: "Activity",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}): Promise<Metadata> {
  const { view } = await searchParams;
  return {
    title: `${viewTitles[view as AdminView] || "Overview"} · Admin`,
  };
}

function DatabaseSetup() {
  return (
    <div className="cms-auth">
      <div className="cms-auth-box">
        <h1>Database setup needed</h1>
        <p>
          The CMS schema and initial catalog must be installed before the admin
          console can load. No storefront content has been changed.
        </p>
        <a href="/admin/login">Return to sign in</a>
      </div>
    </div>
  );
}

export default async function AdminPage({
  searchParams: query,
}: {
  searchParams: Promise<{ view?: string; hold?: string }>;
}) {
  const searchParams = await query;
  const view: AdminView = views.includes(searchParams.view as AdminView)
    ? (searchParams.view as AdminView)
    : "dashboard";
  let auth;
  try {
    auth = await requireAdmin();
  } catch (e) {
    if (e instanceof Error && e.message.includes("permission"))
      redirect("/admin/login?error=access");
    // Come back to the same screen (e.g. the request linked from an email) after signing in.
    const back = new URLSearchParams();
    if (searchParams.view) back.set("view", searchParams.view);
    if (searchParams.hold) back.set("hold", searchParams.hold);
    redirect(
      back.size
        ? `/admin/login?next=${encodeURIComponent(`/admin?${back}`)}`
        : "/admin/login",
    );
  }
  const { db, user, role } = auth;
  // Requests that need a decision, a payment, or a handover. Shown in the
  // top-bar notifications on every view, and as the overview's spotlight.
  const attentionQuery = db
    .from("hold_requests")
    .select("*,hold_request_items(*)")
    .or(
      "status.eq.pending,and(status.eq.accepted,payment_status.neq.paid),and(status.eq.accepted,payment_status.eq.paid,fulfillment_status.eq.not_ready)",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  let trend: AdminRequestTrend[] = [];
  let cards: CMSCard[] = [];
  let collectionCards: AdminCardSummary[] = [];
  let collections: Collection[] = [];
  let settings = defaultSettings;
  let settingsUpdatedAt = "";
  let holds: Hold[] = [];
  let audit: AuditEntry[] = [];
  let orderAlertEmail = "";
  let cardPokemonIds: number[] = [];
  let admins: {
    user_id: string;
    email: string;
    role: "owner" | "editor";
    active: boolean;
  }[] = [];
  let pendingHoldCount = 0;
  let stats: AdminDashboardStats = {
    available: 0,
    drafts: 0,
    newRequests: 0,
    sold: 0,
  };

  // Keep each navigation request small. The previous implementation fetched
  // every CMS table for every tab, including large JSON card and audit rows.
  if (view === "dashboard") {
    const since = new Date(Date.now() - 8 * 7 * 86_400_000);
    const [cardRows, recentHolds, settingsRow, pending, trendRows] = await Promise.all([
      db.from("cards").select("publication,availability"),
      db
        .from("hold_requests")
        .select("*,hold_request_items(*)")
        .order("created_at", { ascending: false })
        .limit(5),
      db
        .from("store_settings")
        .select("data,updated_at")
        .eq("id", true)
        .single(),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      db
        .from("hold_requests")
        .select("created_at,status")
        .gte("created_at", since.toISOString()),
    ]);
    if (
      cardRows.error ||
      recentHolds.error ||
      settingsRow.error ||
      pending.error ||
      trendRows.error
    )
      return <DatabaseSetup />;
    trend = Array.from({ length: 8 }, (_, week) => {
      const start = since.getTime() + week * 7 * 86_400_000;
      const rows = trendRows.data.filter((row) => {
        const created = new Date(row.created_at).getTime();
        return created >= start && created < start + 7 * 86_400_000;
      });
      return {
        start: new Date(start).toISOString(),
        received: rows.length,
        completed: rows.filter((row) => row.status === "completed").length,
      };
    });
    stats = (cardRows.data || []).reduce(
      (result, card) => {
        if (
          card.publication === "published" &&
          card.availability === "available"
        )
          result.available += 1;
        if (card.publication === "draft") result.drafts += 1;
        if (card.availability === "sold") result.sold += 1;
        if (card.availability === "reserved") result.reserved += 1;
        return result;
      },
      { available: 0, reserved: 0, drafts: 0, newRequests: 0, sold: 0 },
    );
    stats.newRequests = pending.count || 0;
    holds = recentHolds.data as Hold[];
    settings = settingsSchema.parse(settingsRow.data.data);
    settingsUpdatedAt = settingsRow.data.updated_at;
    pendingHoldCount = pending.count || 0;
  } else if (view === "cards") {
    const [cardRows, settingsRow, pending] = await Promise.all([
      db
        .from("cards")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      db.from("store_settings").select("data").eq("id", true).single(),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    if (cardRows.error || settingsRow.error || pending.error)
      return <DatabaseSetup />;
    cards = cardRows.data.map(fromRow);
    settings = settingsSchema.parse(settingsRow.data.data);
    pendingHoldCount = pending.count || 0;
  } else if (view === "collections") {
    const [collectionRows, cardRows, pending] = await Promise.all([
      db
        .from("collections")
        .select("*,collection_cards(card_id,sort_order)")
        .order("sort_order"),
      db.from("cards").select("*"),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    if (collectionRows.error || cardRows.error || pending.error)
      return <DatabaseSetup />;
    const allCards = cardRows.data.map(fromRow);
    collectionCards = allCards.map(
      ({ id, name, set, condition, publication }) => ({
        id,
        name,
        set,
        condition,
        publication,
      }),
    );
    collections = collectionRows.data.map((collection) => ({
      id: collection.id,
      name: collection.name,
      sortOrder: collection.sort_order,
      updatedAt: collection.updated_at,
      cardIds: [...collection.collection_cards]
        .sort(
          (a: { sort_order: number }, b: { sort_order: number }) =>
            a.sort_order - b.sort_order,
        )
        .map((membership: { card_id: string }) => membership.card_id),
    }));
    pendingHoldCount = pending.count || 0;
  } else if (view === "holds") {
    const holdsResult = await db
      .from("hold_requests")
      .select("*,hold_request_items(*),hold_status_history(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (holdsResult.error) return <DatabaseSetup />;
    holds = holdsResult.data as Hold[];
    // A link to an older request (beyond the latest 200) still opens it.
    const linked = searchParams.hold;
    if (linked && /^[0-9a-f-]{36}$/i.test(linked) && !holds.some((hold) => hold.id === linked)) {
      const older = await db
        .from("hold_requests")
        .select("*,hold_request_items(*),hold_status_history(*)")
        .eq("id", linked)
        .maybeSingle();
      if (older.data) holds = [...holds, older.data as Hold];
    }
    pendingHoldCount = holds.filter((hold) => hold.status === "pending").length;
  } else if (view === "content") {
    const [settingsRow, pending] = await Promise.all([
      db
        .from("store_settings")
        .select("data,updated_at")
        .eq("id", true)
        .single(),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    if (settingsRow.error || pending.error) return <DatabaseSetup />;
    settings = settingsSchema.parse(settingsRow.data.data);
    settingsUpdatedAt = settingsRow.data.updated_at;
    pendingHoldCount = pending.count || 0;
  } else if (view === "pokedex") {
    const [settingsRow, cardRows, pending] = await Promise.all([
      db
        .from("store_settings")
        .select("data,updated_at")
        .eq("id", true)
        .single(),
      db.from("cards").select("data").eq("publication", "published"),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    if (settingsRow.error || cardRows.error || pending.error)
      return <DatabaseSetup />;
    settings = settingsSchema.parse(settingsRow.data.data);
    settingsUpdatedAt = settingsRow.data.updated_at;
    cardPokemonIds = Array.from(
      new Set(
        cardRows.data
          .map((row: { data: { pokemonId?: number } }) => Number(row.data?.pokemonId))
          .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 386),
      ),
    );
    pendingHoldCount = pending.count || 0;
  } else if (view === "settings") {
    const [settingsRow, adminRows, pending, alertEmail] = await Promise.all([
      db
        .from("store_settings")
        .select("data,updated_at")
        .eq("id", true)
        .single(),
      db.from("admin_users").select("*").order("created_at"),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      db.rpc("cms_get_order_alert_email"),
    ]);
    if (settingsRow.error || adminRows.error || pending.error)
      return <DatabaseSetup />;
    settings = settingsSchema.parse(settingsRow.data.data);
    settingsUpdatedAt = settingsRow.data.updated_at;
    // Older databases without the private setting still load the page.
    orderAlertEmail = alertEmail.error ? "" : String(alertEmail.data || "");
    admins = adminRows.data;
    pendingHoldCount = pending.count || 0;
  } else {
    const [auditRows, adminRows, pending] = await Promise.all([
      db
        .from("audit_log")
        .select("*")
        .order("id", { ascending: false })
        .limit(100),
      db.from("admin_users").select("*").order("created_at"),
      db
        .from("hold_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    if (auditRows.error || adminRows.error || pending.error)
      return <DatabaseSetup />;
    audit = auditRows.data;
    admins = adminRows.data;
    pendingHoldCount = pending.count || 0;
  }

  const attentionRows = await attentionQuery;
  const attention = attentionRows.error ? [] : (attentionRows.data as Hold[]);

  return (
    <AdminConsole
      view={view}
      initialHoldId={searchParams.hold}
      user={{ id: user.id, email: user.email || "", role }}
      cards={cards}
      collectionCards={collectionCards}
      collections={collections}
      settings={settings}
      settingsUpdatedAt={settingsUpdatedAt}
      holds={holds}
      audit={audit}
      admins={admins}
      orderAlertEmail={orderAlertEmail}
      cardPokemonIds={cardPokemonIds}
      pendingHoldCount={pendingHoldCount}
      stats={stats}
      attention={attention}
      trend={trend}
      live={process.env.CMS_ENABLED === "true"}
      stripeReady={stripePaymentsConfigured()}
    />
  );
}
