"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  BookOpen,
  Inbox,
  Type,
  Settings,
  History,
  Plus,
  LogOut,
  ExternalLink,
  Menu,
  X,
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
  saveCollection,
  saveSettings,
  updateHoldWorkflow,
} from "../../app/admin/actions";
import { AdminOverview } from "./AdminOverview";
import { AdminHolds } from "./AdminHolds";
import { AdminCards } from "./AdminCards";
import { AdminCollections } from "./AdminCollections";
import {
  AdminAccess,
  AdminContentForm,
  AdminSettingsForm,
} from "./AdminStoreSettings";
import { AdminActivity } from "./AdminActivity";
import { updateQuery } from "./presentation";
const CardEditor = dynamic(
  () => import("./CardEditor").then((module) => module.CardEditor),
  {
    loading: () => (
      <section className="cms-panel cms-empty" aria-busy="true">
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
  live: boolean;
  stripeReady?: boolean;
};
const navigation = [
  ["dashboard", "Overview", LayoutDashboard, "Sell"],
  ["cards", "Cards", Layers, "Sell"],
  ["holds", "Hold requests", Inbox, "Sell"],
  ["collections", "Collections", BookOpen, "Sell"],
  ["content", "Website content", Type, "Store"],
  ["settings", "Settings", Settings, "Store"],
  ["activity", "Activity", History, "Store"],
] as const;
const descriptions: Record<string, string> = {
  dashboard: "Your collection, ready for its next collector.",
  cards: "Keep every listing accurate, from scan to sale.",
  holds: "Review requests, confirm availability, and complete sales.",
  collections: "Organise your cards into collections collectors can explore.",
  content: "Update the words your collectors see on the storefront.",
  settings: "Manage store preferences, payments, and administrator access.",
  activity: "A clear record of changes made to your store.",
};

export function AdminConsole(props: Props) {
  const {
    cards,
    collectionCards,
    collections,
    settings,
    holds,
    user,
    stats,
    pendingHoldCount,
    stripeReady = false,
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [holdDirty, setHoldDirty] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const pushedEditor = useRef(false);
  const [isPending, startTransition] = useTransition();
  // The card editor is addressed by URL (?edit=<id> or ?action=new) so the
  // back button closes it and a refresh reopens the same listing.
  const editParam = searchParams.get("edit");
  const editing: CMSCard | null | undefined =
    props.view !== "cards"
      ? undefined
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
  }, [props.view]);
  useEffect(() => setDraftSettings(settings), [settings]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!navOpen) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [navOpen]);
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
  const openCardEditor = useCallback((card: CMSCard | null) => {
    pushedEditor.current = true;
    updateQuery(
      card ? { edit: card.id, action: null } : { edit: null, action: "new" },
      "push",
    );
  }, []);
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
    else updateQuery({ edit: null, action: null });
    pushedEditor.current = false;
  }
  const saveHoldWorkflow = (hold: Hold, values: Record<string, string>) =>
    run(() => updateHoldWorkflow(hold.id, values), "Workflow updated.");
  const prefetchView = useCallback(
    (view: string) => {
      void router.prefetch(`/admin?view=${view}`);
    },
    [router],
  );

  function navigateToView(
    event: React.MouseEvent<HTMLAnchorElement>,
    nextView: string,
  ) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (busy) return;
    // Let a second click replace a slow in-flight navigation. This keeps the
    // tab bar responsive when a view is waiting on a database request.
    if (nextView === pendingView) return;
    if (nextView === props.view && !hasOpenEditor) {
      setNavOpen(false);
      return;
    }
    if (
      hasOpenEditor &&
      !window.confirm("Leave the editor and discard any unsaved changes?")
    )
      return;
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

  function transitionHold(hold: Hold, status: string) {
    if (
      !window.confirm(
        status === "completed"
          ? "Mark this sale completed and all cards sold?"
          : status === "accepted"
            ? "Accept this request and reserve all selected cards?"
            : "Close this request and release any reservation?",
      )
    )
      return;
    void run(() => updateHoldWorkflow(hold.id, { status }), "Request updated.");
  }
  const saveDraftSettings = () =>
    void run(
      () => saveSettings(draftSettings, props.settingsUpdatedAt),
      "Changes saved.",
    );
  const editorOpen = editing !== undefined || selectedCollection !== null;
  return (
    <>
      <header className="cms-header">
        <div className="cms-brand">
          <button
            type="button"
            className="cms-menu-btn"
            aria-label="Open admin menu"
            aria-expanded={navOpen}
            aria-controls="cms-nav"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={20} />
            {pendingHoldCount > 0 && (
              <span className="cms-menu-dot" aria-hidden="true" />
            )}
          </button>
          <Link
            href="/admin?view=dashboard"
            onClick={(e) => navigateToView(e, "dashboard")}
          >
            <img src="/images/logo.png" alt="BinderFinders admin" />
          </Link>
          <small>Store manager</small>
        </div>
        <div className="cms-actions">
          <a className="cms-btn" href="/" target="_blank" rel="noreferrer">
            View store <ExternalLink size={14} />
          </a>
          <div className="cms-user">
            <span>{user.email.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.email}</strong>
              <small>{user.role}</small>
            </div>
          </div>
          <button
            className="cms-btn cms-signout"
            disabled={busy}
            aria-label="Sign out"
            onClick={async () => {
              if (
                hasOpenEditor &&
                !window.confirm("Sign out and discard unsaved changes?")
              )
                return;
              await browserClient().auth.signOut();
              window.location.assign("/admin/login");
            }}
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </header>
      <div className="cms-shell">
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
            <strong>Menu</strong>
            <button
              type="button"
              className="cms-icon-btn"
              aria-label="Close admin menu"
              onClick={() => setNavOpen(false)}
            >
              <X size={18} />
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
                onClick={(e) => navigateToView(e, id)}
                onMouseEnter={() => prefetchView(id)}
                onFocus={() => prefetchView(id)}
              >
                <Icon size={18} />
                {label}
                {id === "holds" && pendingHoldCount > 0 && (
                  <span
                    className="cms-badge"
                    aria-label={`${pendingHoldCount} new`}
                  >
                    {pendingHoldCount}
                  </span>
                )}
              </Link>
            </div>
          ))}
          <div className="cms-nav-status">
            <strong>
              <i data-live={props.live} />
              {props.live ? "Store is live" : "Preparation mode"}
            </strong>
            <small>
              {props.live ? "Catalog connected" : "Catalog not activated"}
            </small>
          </div>
        </nav>
        <main className="cms-main" aria-busy={routeLoading}>
          {routeLoading && (
            <div className="cms-route-loading" role="status">
              <span className="cms-route-spinner" aria-hidden="true" />
              Opening {pendingTitle}…
            </div>
          )}
          {!props.live && (
            <div className="cms-notice cms-warning">
              CMS preparation mode. The storefront is still using its existing
              catalog until migration is verified and activated.
            </div>
          )}
          {notice && (
            <div role="status" className="cms-notice cms-toast">
              {notice}
              <button
                type="button"
                className="cms-icon-btn"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="cms-notice cms-error cms-toast">
              {error}
              <button
                type="button"
                className="cms-icon-btn"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {!editorOpen && (
            <div className="cms-title">
              <div>
                <h1>{title}</h1>
                <p>{descriptions[props.view]}</p>
              </div>
              {props.view === "cards" && (
                <button
                  className="cms-btn cms-btn-primary"
                  onClick={handleAddCard}
                >
                  <Plus size={17} />
                  Add card
                </button>
              )}
              {props.view === "dashboard" && (
                <Link
                  className="cms-btn cms-btn-primary"
                  href="/admin?view=cards&action=new"
                >
                  <Plus size={17} />
                  Add card
                </Link>
              )}
              {props.view === "collections" && collections.length > 0 && (
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
            </div>
          )}
          {props.view === "dashboard" && (
            <AdminOverview
              stats={stats}
              holds={holds}
              settings={settings}
              stripeReady={stripeReady}
            />
          )}
          {props.view === "cards" && (
            <>
              {editing !== undefined && (
                <CardEditor
                  key={editing?.id || "new"}
                  card={editing}
                  onClose={closeCardEditor}
                />
              )}
              <AdminCards
                cards={cards}
                currency={settings.currency}
                initialFilter={searchParams.get("filter")}
                hidden={editing !== undefined}
                onEdit={handleEdit}
                onAdd={handleAddCard}
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
              onTransition={transitionHold}
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
            <>
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
            </>
          )}
          {props.view === "activity" && (
            <AdminActivity audit={props.audit} admins={props.admins} />
          )}
        </main>
      </div>
    </>
  );
}
