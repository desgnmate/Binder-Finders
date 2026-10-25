"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  BookOpen,
  Inbox,
  Type,
  SlidersHorizontal,
  History,
  Plus,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  ArrowRight,
  Check,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import { browserClient } from "../../lib/supabase/browser";
import {
  type CMSCard,
  type AdminCardSummary,
  type AdminDashboardStats,
  type Collection,
  type StoreSettings,
  type Hold,
  type AuditEntry,
} from "../../lib/cms/types";
import {
  saveCard,
  saveCollection,
  saveSettings,
  updateHoldWorkflow,
} from "../../app/admin/actions";
import { AdminOverview, type AdminRequestTrend } from "./AdminOverview";
import { AdminHolds } from "./AdminHolds";
import { AdminCards } from "./AdminCards";
import { AdminCollections } from "./AdminCollections";
import {
  AdminAccess,
  AdminContentForm,
  AdminSettingsForm,
} from "./AdminStoreSettings";
import { AdminActivity } from "./AdminActivity";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";
import {
  awaitingPayment,
  holdTotal,
  initials,
  storeDate,
  timeAgo,
  timeUntil,
  updateQuery,
} from "./presentation";
const CardEditor = dynamic(
  () => import("./CardEditor").then((module) => module.CardEditor),
  {
    loading: () => (
      <section className="cms-panel cms-empty" aria-busy="true">
        <span className="cms-spinner" />
        Loading editor…
      </section>
    ),
  },
);
type Props = {
  view: string;
  initialHoldId?: string;
  user: { id: string; email: string; role: "owner" | "editor" };
  cards: CMSCard[];
  collectionCards: AdminCardSummary[];
  collections: Collection[];
  settings: StoreSettings;
  settingsUpdatedAt: string;
  holds: Hold[];
  audit: AuditEntry[];
  admins: {
    user_id: string;
    email: string;
    role: "owner" | "editor";
    active: boolean;
  }[];
  pendingHoldCount: number;
  stats: AdminDashboardStats;
  attention?: Hold[];
  trend?: AdminRequestTrend[];
  live: boolean;
  stripeReady?: boolean;
};
const navigation = [
  ["dashboard", "Overview", LayoutDashboard, "Sell"],
  ["cards", "Cards", Layers, "Sell"],
  ["holds", "Hold requests", Inbox, "Sell"],
  ["collections", "Collections", BookOpen, "Sell"],
  ["content", "Website content", Type, "Store"],
  ["settings", "Settings", SlidersHorizontal, "Store"],
  ["activity", "Activity", History, "Store"],
] as const;
const descriptions: Record<string, string> = {
  cards: "Keep every listing accurate, from scan to sale.",
  holds: "Review requests, confirm availability, and complete sales.",
  collections: "Organise your cards into collections collectors can explore.",
  content: "Update the words your collectors see on the storefront.",
  settings: "Manage store preferences, payments, and administrator access.",
  activity: "A clear record of changes made to your store.",
};
const timeZone = "Australia/Melbourne";

type Notice = { id: string; tone: "new" | "urgent" | "paid"; title: string; detail: string; when: string };

// What needs the admin, derived from open requests: new ones, unpaid holds
// close to their deadline, and paid orders waiting to be handed over.
function notificationsFor(attention: Hold[]): Notice[] {
  const now = Date.now();
  const urgent = attention
    .filter(
      (hold) =>
        awaitingPayment(hold) &&
        hold.expires_at &&
        new Date(hold.expires_at).getTime() - now < 24 * 3_600_000,
    )
    .map((hold) => ({
      id: hold.id,
      tone: "urgent" as const,
      title: `Hold expires ${timeUntil(hold.expires_at as string, now)}`,
      detail: `${hold.name} · unpaid`,
      when: `Deadline ${storeDate(hold.expires_at as string, true)}`,
    }));
  const fresh = attention
    .filter((hold) => hold.status === "pending")
    .map((hold) => ({
      id: hold.id,
      tone: "new" as const,
      title: `New request from ${hold.name}`,
      detail: `${hold.hold_request_items.map((item) => item.name).join(", ")} · ${holdTotal(hold)}`,
      when: timeAgo(hold.created_at, now),
    }));
  const paid = attention
    .filter(
      (hold) =>
        hold.payment_status === "paid" &&
        (hold.fulfillment_status || "not_ready") === "not_ready",
    )
    .map((hold) => ({
      id: hold.id,
      tone: "paid" as const,
      title: "Payment received",
      detail: `${hold.name} · ${holdTotal(hold)} · ready to fulfil`,
      when: timeAgo(hold.paid_at || hold.created_at, now),
    }));
  return [...urgent, ...fresh, ...paid].slice(0, 6);
}

export function AdminConsole(props: Props) {
  return (
    <ConfirmProvider>
      <Console {...props} />
    </ConfirmProvider>
  );
}

function Console(props: Props) {
  const {
    cards,
    collectionCards,
    collections,
    settings,
    holds,
    user,
    stats,
    pendingHoldCount,
    attention = [],
    stripeReady = false,
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [holdDirty, setHoldDirty] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [menu, setMenu] = useState<"notifications" | "account" | null>(null);
  const [search, setSearch] = useState("");
  const menus = useRef<HTMLDivElement>(null);
  const pushedEditor = useRef(false);
  const [isPending, startTransition] = useTransition();
  // The card editor is addressed by URL (?edit=<id>, ?action=new, or
  // ?action=new&from=<id> to duplicate) so the back button closes it and a
  // refresh reopens the same listing.
  const editParam = searchParams.get("edit");
  const duplicateFrom =
    searchParams.get("action") === "new"
      ? cards.find((card) => card.id === searchParams.get("from"))
      : undefined;
  const editing: CMSCard | null | undefined =
    props.view !== "cards"
      ? undefined
      : duplicateFrom
        ? {
            ...duplicateFrom,
            id: `${duplicateFrom.id}-copy`.slice(0, 100),
            publication: "draft",
            availability: "available",
            featuredOrder: null,
            updatedAt: null,
          }
        : searchParams.get("action") === "new"
          ? null
          : editParam
            ? cards.find((card) => card.id === editParam)
            : undefined;
  const settingsDirty = useMemo(
    () =>
      (props.view === "content" || props.view === "settings") &&
      JSON.stringify(draftSettings) !== JSON.stringify(settings),
    [draftSettings, props.view, settings],
  );
  const hasOpenEditor =
    editing !== undefined ||
    selectedCollection !== null ||
    settingsDirty ||
    holdDirty;
  const notifications = useMemo(() => notificationsFor(attention), [attention]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (settingsDirty || selectedCollection || holdDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [settingsDirty, selectedCollection, holdDirty]);
  useEffect(() => {
    setSelectedCollection(null);
    setNotice("");
    setError("");
    setPendingView(null);
    setHoldDirty(false);
    setNavOpen(false);
    setMenu(null);
  }, [props.view]);
  useEffect(() => setDraftSettings(settings), [settings]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!navOpen && !menu) return;
    const keydown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setNavOpen(false);
      setMenu(null);
    };
    const pointer = (e: MouseEvent) => {
      if (menu && !menus.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("keydown", keydown);
    document.addEventListener("mousedown", pointer);
    return () => {
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("mousedown", pointer);
    };
  }, [navOpen, menu]);
  const title = navigation.find(([id]) => id === props.view)?.[1] || "Overview";
  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error || "Could not save changes");
        return false;
      }
      setNotice(success);
      router.refresh();
      return true;
    } catch {
      setError(
        "Connection interrupted. Reload to check the current state before retrying.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const pendingTitle =
    navigation.find(([id]) => id === pendingView)?.[1] || title;
  const routeLoading = isPending || pendingView !== null;
  const openCardEditor = useCallback(
    (card: CMSCard | null, mode: "edit" | "duplicate" = "edit") => {
      pushedEditor.current = true;
      updateQuery(
        !card
          ? { edit: null, from: null, action: "new" }
          : mode === "duplicate"
            ? { edit: null, from: card.id, action: "new" }
            : { edit: card.id, from: null, action: null },
        "push",
      );
    },
    [],
  );
  const handleEdit = useCallback(
    (card: CMSCard) => openCardEditor(card),
    [openCardEditor],
  );
  const handleAddCard = useCallback(
    () => openCardEditor(null),
    [openCardEditor],
  );
  function closeCardEditor(saved?: boolean) {
    // Step back through history when the editor added its own entry, so the
    // list keeps its place. After a save, replace instead so the refreshed
    // catalog is not swapped for the cached one.
    if (!saved && pushedEditor.current) window.history.back();
    else updateQuery({ edit: null, from: null, action: null });
    pushedEditor.current = false;
  }
  const saveHoldWorkflow = (hold: Hold, values: Record<string, string>) =>
    run(() => updateHoldWorkflow(hold.id, values), "Request updated.");
  const prefetchView = useCallback(
    (view: string) => {
      void router.prefetch(`/admin?view=${view}`);
    },
    [router],
  );
  const confirmLeave = () =>
    confirm({
      title: "Leave without saving?",
      body: "Your unsaved changes will be lost.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      tone: "danger",
      icon: "edit",
    });

  async function navigateToView(
    event: React.MouseEvent<HTMLAnchorElement>,
    nextView: string,
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (busy) return;
    // Let a second click replace a slow in-flight navigation. This keeps the
    // menu responsive when a view is waiting on a database request.
    if (nextView === pendingView) return;
    if (nextView === props.view && !hasOpenEditor) {
      setNavOpen(false);
      return;
    }
    if (hasOpenEditor && !(await confirmLeave())) return;
    setNavOpen(false);
    if (nextView === props.view) {
      // Same section: just close whichever editor is open.
      setSelectedCollection(null);
      setDraftSettings(settings);
      if (editing !== undefined) closeCardEditor();
      return;
    }
    setPendingView(nextView);
    startTransition(() => router.push(`/admin?view=${nextView}`));
  }

  async function transitionHold(hold: Hold, status: string) {
    const cardNames = hold.hold_request_items.map((item) => item.name);
    const summary = (
      <div className="cms-modal-summary">
        {hold.hold_request_items.map((item) => (
          <div key={item.card_id}>
            <span>{item.name}</span>
            <strong className="cms-money">
              {hold.currency}{" "}
              {(item.price_cents / 100).toLocaleString("en-AU", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
        ))}
        <div>
          <span className="cms-muted">Total</span>
          <strong className="cms-money">{holdTotal(hold)}</strong>
        </div>
      </div>
    );
    const ok = await confirm(
      status === "accepted"
        ? {
            title: "Accept and reserve these cards?",
            body: `They'll be held for ${hold.name} until the hold deadline, and taken off sale for everyone else.`,
            details: summary,
            confirmLabel: "Accept & reserve",
            icon: "lock",
          }
        : status === "completed"
          ? {
              title: "Complete this sale?",
              body: `All ${cardNames.length} ${cardNames.length === 1 ? "card" : "cards"} will be marked sold and leave the storefront.`,
              details: (
                <ul className="cms-modal-checks">
                  <li>
                    <Check size={18} />
                    <span>
                      <strong>Payment recorded</strong> · {holdTotal(hold)}
                    </span>
                  </li>
                  <li>
                    <Check size={18} />
                    <span>
                      <strong>Fulfilment</strong> ·{" "}
                      {(hold.fulfillment_status || "").replaceAll("_", " ")}
                    </span>
                  </li>
                </ul>
              ),
              confirmLabel: "Complete sale",
              cancelLabel: "Not yet",
              icon: "check",
            }
          : status === "rejected"
            ? {
                title: "Decline this request?",
                body: `${hold.name}'s cards stay on sale for other collectors.`,
                confirmLabel: "Reject request",
                tone: "danger",
              }
            : {
                title: "Cancel this hold and release the cards?",
                body: `${cardNames.join(" and ")} go back on sale straight away, and ${hold.name} can no longer pay for this request. This can't be undone.`,
                confirmLabel: "Cancel & release",
                cancelLabel: "Keep the hold",
                tone: "danger",
              },
    );
    if (!ok) return;
    void run(
      () => updateHoldWorkflow(hold.id, { status }),
      status === "accepted"
        ? "Request accepted. The cards are reserved."
        : status === "completed"
          ? "Sale completed."
          : status === "rejected"
            ? "Request declined."
            : "Hold cancelled and cards released.",
    );
  }
  async function quickUpdateCard(
    card: CMSCard,
    publication: CMSCard["publication"],
  ) {
    if (
      publication === "archived" &&
      !(await confirm({
        title: `Archive ${card.name}?`,
        body: "It will be hidden from the storefront. You can publish it again later.",
        confirmLabel: "Archive listing",
        tone: "dark",
        icon: "warning",
      }))
    )
      return;
    void run(
      () => saveCard({ ...card, publication }),
      publication === "published"
        ? `${card.name} is live on the storefront.`
        : `${card.name} was archived.`,
    );
  }
  const saveDraftSettings = () =>
    void run(
      () => saveSettings(draftSettings, props.settingsUpdatedAt),
      "Changes saved.",
    );
  async function signOut() {
    if (
      hasOpenEditor &&
      !(await confirm({
        title: "Sign out without saving?",
        body: "Your unsaved changes will be lost.",
        confirmLabel: "Sign out",
        cancelLabel: "Keep editing",
        tone: "danger",
        icon: "edit",
      }))
    )
      return;
    await browserClient().auth.signOut();
    window.location.assign("/admin/login");
  }
  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (hasOpenEditor && !(await confirmLeave())) return;
    setSearch("");
    router.push(`/admin?view=cards${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  }
  const editorOpen = editing !== undefined || selectedCollection !== null;
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(new Date()),
  );
  const today = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date());

  return (
    <div className="cms-app">
      {navOpen && (
        <div
          className="cms-nav-backdrop"
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
        />
      )}
      <nav
        id="cms-nav"
        className="cms-nav"
        aria-label="Admin navigation"
        data-open={navOpen}
      >
        <div className="cms-nav-drawer-heading">
          <Link
            href="/admin?view=dashboard"
            className="cms-brand-mark"
            aria-label="BinderFinders admin home"
            onClick={(e) => void navigateToView(e, "dashboard")}
          >
            BF
          </Link>
          <span className="cms-brand-text">
            <strong>BinderFinders</strong>
            <small>Store manager</small>
          </span>
          <button
            type="button"
            className="cms-icon-btn cms-nav-close"
            aria-label="Close admin menu"
            onClick={() => setNavOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        {navigation.map(([id, label, Icon, group], index) => (
          <div key={id} className="cms-nav-item">
            {navigation[index - 1]?.[3] !== group && (
              <span className="cms-nav-group">{group}</span>
            )}
            <Link
              href={`/admin?view=${id}`}
              aria-current={props.view === id ? "page" : undefined}
              className={pendingView === id ? "cms-nav-pending" : undefined}
              onClick={(e) => void navigateToView(e, id)}
              onMouseEnter={() => prefetchView(id)}
              onFocus={() => prefetchView(id)}
            >
              <Icon size={18} />
              {label}
              {id === "holds" && pendingHoldCount > 0 && (
                <span
                  className="cms-count"
                  aria-label={`${pendingHoldCount} new`}
                >
                  {pendingHoldCount}
                </span>
              )}
            </Link>
          </div>
        ))}
        <div className="cms-nav-footer">
          <div className="cms-nav-status">
            <strong>
              <i data-live={props.live} />
              {props.live ? "Store is live" : "Preparation mode"}
            </strong>
            <small>
              {props.live ? "Catalog connected" : "Catalog not activated"}
            </small>
          </div>
          <button
            type="button"
            className="cms-nav-signout"
            disabled={busy}
            onClick={() => void signOut()}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </nav>
      <main className="cms-main" aria-busy={routeLoading}>
        <header className="cms-topbar">
          <button
            type="button"
            className="cms-circle cms-menu-btn"
            aria-label="Open admin menu"
            aria-expanded={navOpen}
            aria-controls="cms-nav"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={19} />
          </button>
          <div className="cms-title">
            {!editorOpen &&
              (props.view === "dashboard" ? (
                <>
                  <h1 suppressHydrationWarning>
                    {hour < 12
                      ? "Good morning"
                      : hour < 18
                        ? "Good afternoon"
                        : "Good evening"}
                  </h1>
                  <p suppressHydrationWarning>
                    {today} ·{" "}
                    {notifications.length
                      ? `${notifications.length} ${notifications.length === 1 ? "request needs" : "requests need"} you`
                      : "nothing needs you right now"}
                  </p>
                </>
              ) : (
                <>
                  <h1>{title}</h1>
                  <p>{descriptions[props.view]}</p>
                </>
              ))}
          </div>
          <div className="cms-topbar-actions" ref={menus}>
            {props.view === "cards" && !editorOpen && (
              <button
                className="cms-btn cms-btn-primary"
                onClick={handleAddCard}
              >
                <Plus size={17} />
                Add card
              </button>
            )}
            {props.view === "collections" &&
              !editorOpen &&
              collections.length > 0 && (
                <button
                  className="cms-btn cms-btn-primary"
                  onClick={() =>
                    setSelectedCollection({
                      id: "",
                      name: "",
                      sortOrder: collections.length,
                      cardIds: [],
                    })
                  }
                >
                  <Plus size={17} />
                  New collection
                </button>
              )}
            {props.view === "dashboard" && (
              <form
                className="cms-topsearch"
                role="search"
                onSubmit={(e) => void submitSearch(e)}
              >
                <Search size={17} />
                <input
                  type="search"
                  aria-label="Search cards"
                  placeholder="Search cards…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            )}
            <div className="cms-popover">
              <button
                type="button"
                className="cms-circle"
                aria-label={
                  notifications.length
                    ? `Notifications, ${notifications.length} need attention`
                    : "Notifications"
                }
                aria-expanded={menu === "notifications"}
                aria-haspopup="true"
                onClick={() =>
                  setMenu(menu === "notifications" ? null : "notifications")
                }
              >
                <Bell size={18} />
                {notifications.length > 0 && <span className="cms-dot" />}
              </button>
              {menu === "notifications" && (
                <section
                  className="cms-menu cms-menu-wide"
                  aria-label="Notifications"
                >
                  <div className="cms-menu-head">
                    <h2>Needs your attention</h2>
                    {notifications.length > 0 && (
                      <span className="cms-count">{notifications.length}</span>
                    )}
                  </div>
                  {notifications.length ? (
                    notifications.map((item) => (
                      <Link
                        key={`${item.tone}-${item.id}`}
                        className="cms-notif"
                        data-tone={item.tone === "new" ? "new" : undefined}
                        href={`/admin?view=holds&hold=${item.id}`}
                        onClick={() => setMenu(null)}
                      >
                        <span className="cms-notif-icon" data-tone={item.tone}>
                          {item.tone === "new" ? (
                            <Inbox size={17} />
                          ) : item.tone === "urgent" ? (
                            <Clock3 size={17} />
                          ) : (
                            <Check size={17} />
                          )}
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                          <small>{item.when}</small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="cms-menu-empty">
                      You&apos;re all caught up. New requests, payments and
                      expiring holds show up here.
                    </p>
                  )}
                  <Link
                    className="cms-menu-footer"
                    href="/admin?view=holds"
                    onClick={() => setMenu(null)}
                  >
                    Open hold requests <ArrowRight size={15} />
                  </Link>
                </section>
              )}
            </div>
            <a
              className="cms-circle"
              href="/"
              target="_blank"
              rel="noreferrer"
              aria-label="View store (opens in a new tab)"
            >
              <ExternalLink size={18} />
            </a>
            <div className="cms-popover">
              <button
                type="button"
                className="cms-user-chip"
                aria-expanded={menu === "account"}
                aria-haspopup="true"
                aria-label={`Account: ${user.email}`}
                onClick={() => setMenu(menu === "account" ? null : "account")}
              >
                <span className="cms-avatar" aria-hidden="true">
                  {initials(user.email.split("@")[0].replace(/[._-]+/g, " "))}
                </span>
                <span>
                  <strong>{user.email}</strong>
                  <small>{user.role}</small>
                </span>
                <ChevronDown size={16} />
              </button>
              {menu === "account" && (
                <div className="cms-menu" role="menu" aria-label="Account">
                  <div className="cms-menu-account">
                    <span className="cms-avatar" aria-hidden="true">
                      {initials(
                        user.email.split("@")[0].replace(/[._-]+/g, " "),
                      )}
                    </span>
                    <span>
                      <strong>{user.role === "owner" ? "Owner" : "Editor"}</strong>
                      <small>{user.email}</small>
                    </span>
                  </div>
                  <a
                    role="menuitem"
                    className="cms-menu-item"
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={17} />
                    View storefront
                  </a>
                  <Link
                    role="menuitem"
                    className="cms-menu-item"
                    href="/admin?view=settings"
                    onClick={(e) => {
                      setMenu(null);
                      void navigateToView(e, "settings");
                    }}
                  >
                    <SlidersHorizontal size={17} />
                    Store settings
                  </Link>
                  <Link
                    role="menuitem"
                    className="cms-menu-item"
                    href="/admin?view=activity"
                    onClick={(e) => {
                      setMenu(null);
                      void navigateToView(e, "activity");
                    }}
                  >
                    <History size={17} />
                    Activity log
                  </Link>
                  <span className="cms-menu-sep" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="cms-menu-item"
                    data-tone="danger"
                    disabled={busy}
                    onClick={() => {
                      setMenu(null);
                      void signOut();
                    }}
                  >
                    <LogOut size={17} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {routeLoading && (
          <div className="cms-route-loading" role="status">
            <span className="cms-spinner" aria-hidden="true" />
            Opening {pendingTitle}…
          </div>
        )}
        {!props.live && (
          <div className="cms-banner" data-tone="warning" role="note">
            <AlertTriangle size={18} />
            <span>
              <strong>Preparation mode.</strong> The storefront still uses its
              existing catalog until the CMS is verified and activated.
            </span>
          </div>
        )}
        {notice && (
          <div role="status" className="cms-toast">
            <span className="cms-toast-icon">
              <Check size={15} strokeWidth={3} />
            </span>
            <span>{notice}</span>
            <button
              type="button"
              className="cms-icon-btn"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="cms-toast">
            <span className="cms-toast-icon">
              <AlertTriangle size={15} />
            </span>
            <span>{error}</span>
            <button
              type="button"
              className="cms-icon-btn"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {props.view === "dashboard" && (
          <AdminOverview
            stats={stats}
            holds={holds}
            settings={settings}
            stripeReady={stripeReady}
            attention={props.attention}
            trend={props.trend}
          />
        )}
        {props.view === "cards" && (
          <>
            {editing !== undefined && (
              <CardEditor
                key={editing?.id || "new"}
                card={editing}
                currency={settings.currency}
                onClose={closeCardEditor}
                onDuplicate={(card) => openCardEditor(card, "duplicate")}
              />
            )}
            <AdminCards
              key={searchParams.get("q") ?? ""}
              cards={cards}
              currency={settings.currency}
              initialFilter={searchParams.get("filter")}
              initialQuery={searchParams.get("q") ?? ""}
              hidden={editing !== undefined}
              busy={busy}
              onEdit={handleEdit}
              onAdd={handleAddCard}
              onDuplicate={(card) => openCardEditor(card, "duplicate")}
              onSetPublication={(card, publication) =>
                void quickUpdateCard(card, publication)
              }
            />
          </>
        )}
        {props.view === "collections" && (
          <AdminCollections
            collections={collections}
            cards={collectionCards}
            selected={selectedCollection}
            busy={busy}
            onSelect={setSelectedCollection}
            onSave={(collection) =>
              run(() => saveCollection(collection), "Collection saved.")
            }
          />
        )}
        {props.view === "holds" && (
          <AdminHolds
            holds={holds}
            initialHoldId={props.initialHoldId}
            busy={busy}
            onSave={saveHoldWorkflow}
            onTransition={(hold, status) => void transitionHold(hold, status)}
            onDirtyChange={setHoldDirty}
          />
        )}
        {props.view === "content" && (
          <AdminContentForm
            draft={draftSettings}
            dirty={settingsDirty}
            busy={busy}
            onChange={setDraftSettings}
            onDiscard={() => setDraftSettings(settings)}
            onSave={saveDraftSettings}
          />
        )}
        {props.view === "settings" && (
          <div className="cms-settings">
            <AdminSettingsForm
              draft={draftSettings}
              dirty={settingsDirty}
              busy={busy}
              canEdit={user.role === "owner"}
              stripeReady={stripeReady}
              onChange={setDraftSettings}
              onDiscard={() => setDraftSettings(settings)}
              onSave={saveDraftSettings}
            />
            {user.role === "owner" && (
              <AdminAccess
                admins={props.admins}
                userId={user.id}
                busy={busy}
                run={run}
              />
            )}
          </div>
        )}
        {props.view === "activity" && (
          <AdminActivity audit={props.audit} admins={props.admins} />
        )}
      </main>
    </div>
  );
}
