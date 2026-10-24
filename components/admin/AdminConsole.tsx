"use client";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
  inviteAdmin,
  setAdmin,
} from "../../app/admin/actions";
import { AdminOverview } from "./AdminOverview";
import { AdminHolds } from "./AdminHolds";
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
  initialAction?: string;
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
  ["dashboard", "Overview", LayoutDashboard],
  ["cards", "Cards", Layers],
  ["holds", "Hold requests", Inbox],
  ["collections", "Collections", BookOpen],
  ["content", "Website content", Type],
  ["settings", "Settings", Settings],
  ["activity", "Activity", History],
] as const;

const CardsTable = memo(function CardsTable({
  cards,
  currency,
  onEdit,
}: {
  cards: CMSCard[];
  currency: string;
  onEdit: (card: CMSCard) => void;
}) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
      }),
    [],
  );

  return (
    <div className="cms-scroll">
      <table>
        <thead>
          <tr>
            <th>Card</th>
            <th>Condition</th>
            <th>Price {currency}</th>
            <th>Publication</th>
            <th>Availability</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <div className="cms-card-cell">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : <span className="cms-scan-placeholder" aria-label="No scan uploaded"><Layers size={18} /><small>{card.number}</small></span>}
                  <div>
                    <strong>{card.name}</strong>
                    <small>
                      {card.set} · {card.number}
                    </small>
                  </div>
                </div>
              </td>
              <td>{card.condition}</td>
              <td>{formatter.format(card.price)}</td>
              <td>
                <span className="cms-badge" data-status={card.publication}>
                  {card.publication}
                </span>
              </td>
              <td>
                <span className="cms-badge" data-status={card.availability}>
                  {card.availability}
                </span>
              </td>
              <td>
                <button
                  className="cms-btn"
                  onClick={() => onEdit(card)}
                  aria-label={`Edit ${card.name} ${card.id}`}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function PageControls({
  page,
  pageSize,
  total,
  label,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  label: string;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount < 2) return null;
  const first = page * pageSize + 1;
  const last = Math.min(first + pageSize - 1, total);
  return (
    <nav className="cms-pagination" aria-label={`${label} pages`}>
      <p aria-live="polite">
        Showing {first}–{last} of {total} {label}
      </p>
      <div>
        <button
          type="button"
          className="cms-btn"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          className="cms-btn"
          disabled={page + 1 >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<CMSCard | null | undefined>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [invite, setInvite] = useState("");
  const [existingId, setExistingId] = useState("");
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [cardsPage, setCardsPage] = useState(0);
  const [holdDirty, setHoldDirty] = useState(false);
  const [sort, setSort] = useState("recent");
  const [isPending, startTransition] = useTransition();
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
    setEditing(
      props.view === "cards" && props.initialAction === "new"
        ? null
        : undefined,
    );
    setSelectedCollection(null);
    setNotice("");
    setError("");
    setQuery("");
    setFilter("all");
    setPendingView(null);
    setCardsPage(0);
    setSort("recent");
    setHoldDirty(false);
  }, [props.view, props.initialAction]);
  useEffect(() => setDraftSettings(settings), [settings]);
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
  const title = navigation.find(([id]) => id === props.view)?.[1] || "Overview";
  const pendingTitle =
    navigation.find(([id]) => id === pendingView)?.[1] || title;
  const routeLoading = isPending || pendingView !== null;
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const visibleCards = useMemo(
    () =>
      [...cards]
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "price-low"
              ? a.price - b.price
              : sort === "price-high"
                ? b.price - a.price
                : 0,
        )
        .filter(
          (c) =>
            (filter === "all" ||
              c.publication === filter ||
              c.availability === filter) &&
            `${c.id} ${c.name} ${c.set}`
              .toLowerCase()
              .includes(normalizedQuery),
        ),
    [cards, filter, normalizedQuery, sort],
  );
  const cardPageSize = 40;
  const visibleCardPage = visibleCards.slice(
    cardsPage * cardPageSize,
    (cardsPage + 1) * cardPageSize,
  );
  const cardNameById = useMemo(
    () => new Map(collectionCards.map((card) => [card.id, card.name])),
    [collectionCards],
  );
  const handleEdit = useCallback((card: CMSCard) => setEditing(card), []);
  const handleAddCard = useCallback(() => setEditing(null), []);
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
    if (nextView === props.view || nextView === pendingView) return;
    if (
      hasOpenEditor &&
      !window.confirm("Leave the editor and discard any unsaved changes?")
    )
      return;
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
  return (
    <>
      <header className="cms-header">
        <div className="cms-brand">
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
            Sign out
          </button>
        </div>
      </header>
      <div className="cms-shell">
        <nav className="cms-nav" aria-label="Admin navigation">
          {navigation.map(([id, label, Icon]) => (
            <div key={id} className="cms-nav-item">
              {(id === "dashboard" || id === "content") && (
                <span className="cms-nav-group">
                  {id === "dashboard" ? "Sell" : "Store"}
                </span>
              )}
              <Link
                key={id}
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
                  <span className="cms-badge">{pendingHoldCount}</span>
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
            <div role="status" className="cms-notice">
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="cms-notice cms-error">
              {error}
            </div>
          )}
          {props.view === "cards" && editing !== undefined ? (
            <CardEditor
              key={editing?.id || "new"}
              card={editing}
              onClose={() => setEditing(undefined)}
            />
          ) : (
            <>
              <div className="cms-title">
                <div>
                  <h1>{title}</h1>
                  <p>
                    {props.view === "dashboard"
                      ? "Your collection, ready for its next collector."
                      : props.view === "cards"
                        ? "Keep every listing accurate, from scan to sale."
                        : props.view === "holds"
                          ? "Review requests, confirm availability, and complete sales."
                          : props.view === "content"
                            ? "Update the words your collectors see."
                            : props.view === "collections"
                              ? "Organise your cards into collections collectors can explore."
                              : props.view === "settings"
                                ? "Manage store preferences, payments, and administrator access."
                                : props.view === "activity"
                                  ? "A clear record of changes made to your store."
                                  : ""}
                  </p>
                </div>
                {["cards", "dashboard"].includes(props.view) && (
                  <button
                    className="cms-btn cms-btn-primary"
                    onClick={() =>
                      props.view === "cards"
                        ? handleAddCard()
                        : router.push("/admin?view=cards&action=new")
                    }
                  >
                    <Plus size={17} />
                    Add card
                  </button>
                )}
              </div>
              {props.view === "dashboard" && (
                <AdminOverview
                  stats={stats}
                  holds={holds}
                  settings={settings}
                  stripeReady={stripeReady}
                />
              )}
              {props.view === "cards" && (
                <section className="cms-panel cms-cards-panel">
                  <div className="cms-listing-tabs" aria-label="Listing status">
                    {[
                      ["all", "All"],
                      ["available", "Available"],
                      ["reserved", "On hold"],
                      ["draft", "Drafts"],
                      ["sold", "Sold"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => {
                          setCardsPage(0);
                          setFilter(value);
                        }}
                      >
                        {label}
                        <span>
                          {
                            cards.filter(
                              (c) =>
                                value === "all" ||
                                c.publication === value ||
                                c.availability === value,
                            ).length
                          }
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="cms-toolbar">
                    <input
                      aria-label="Search cards"
                      placeholder="Search name, set or listing ID…"
                      value={query}
                      onChange={(e) => {
                        setCardsPage(0);
                        setQuery(e.target.value);
                      }}
                    />
                    <select
                      aria-label="Filter listings"
                      value={filter}
                      onChange={(e) => {
                        setCardsPage(0);
                        setFilter(e.target.value);
                      }}
                    >
                      {[
                        "all",
                        "published",
                        "draft",
                        "archived",
                        "available",
                        "reserved",
                        "sold",
                        "unavailable",
                      ].map((v) => (
                        <option key={v} value={v}>{v === "all" ? "All statuses" : v === "reserved" ? "On hold" : v.charAt(0).toUpperCase() + v.slice(1)}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Sort listings"
                      value={sort}
                      onChange={(e) => {
                        setCardsPage(0);
                        setSort(e.target.value);
                      }}
                    >
                      <option value="recent">Newest listings</option>
                      <option value="name">Name A–Z</option>
                      <option value="price-low">Price: low to high</option>
                      <option value="price-high">Price: high to low</option>
                    </select>
                  </div>
                  <CardsTable
                    cards={visibleCardPage}
                    currency={settings.currency}
                    onEdit={handleEdit}
                  />
                  {!visibleCards.length && (
                    <p className="cms-empty">
                      No listings match. Add a card or change the filter.
                    </p>
                  )}
                  <PageControls
                    page={cardsPage}
                    pageSize={cardPageSize}
                    total={visibleCards.length}
                    label="listings"
                    onChange={setCardsPage}
                  />
                  <p className="cms-muted" style={{ marginTop: 12 }}>
                    {visibleCards.length} matching listings
                    {cards.length === 1000 ? " · Showing the latest 1,000" : ""}
                  </p>
                </section>
              )}
              {props.view === "collections" && (
                <>
                  <div className="cms-actions" style={{ marginBottom: 20 }}>
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
                      <Plus size={16} />
                      New collection
                    </button>
                  </div>
                  {selectedCollection ? (
                    <form
                      className="cms-panel"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await run(
                            () => saveCollection(selectedCollection),
                            "Collection saved.",
                          )
                        )
                          setSelectedCollection(null);
                      }}
                    >
                      <fieldset disabled={busy}>
                        <div className="cms-grid">
                          <label className="cms-field">
                            Collection name
                            <input
                              required
                              maxLength={80}
                              value={selectedCollection.name}
                              onChange={(e) =>
                                setSelectedCollection({
                                  ...selectedCollection,
                                  name: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="cms-field">
                            Collection ID
                            <input
                              required
                              pattern="[a-z0-9][a-z0-9-]*"
                              disabled={Boolean(selectedCollection.updatedAt)}
                              value={selectedCollection.id}
                              onChange={(e) =>
                                setSelectedCollection({
                                  ...selectedCollection,
                                  id: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="cms-field">
                            Display order
                            <input
                              type="number"
                              min={0}
                              max={9999}
                              value={selectedCollection.sortOrder}
                              onChange={(e) =>
                                setSelectedCollection({
                                  ...selectedCollection,
                                  sortOrder: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <div className="cms-wide">
                            <h3>Cards in display order</h3>
                            <p className="cms-muted">
                              Select cards below. Use the arrows to change their
                              order.
                            </p>
                            {selectedCollection.cardIds.map((id, i) => (
                              <div
                                className="cms-actions"
                                key={id}
                                style={{ margin: "6px 0" }}
                              >
                                <span style={{ flex: 1 }}>
                                  {cardNameById.get(id) || id} · {id}
                                </span>
                                <button
                                  type="button"
                                  className="cms-btn"
                                  disabled={i === 0}
                                  aria-label={`Move ${id} up`}
                                  onClick={() => {
                                    const next = [
                                      ...selectedCollection.cardIds,
                                    ];
                                    [next[i - 1], next[i]] = [
                                      next[i],
                                      next[i - 1],
                                    ];
                                    setSelectedCollection({
                                      ...selectedCollection,
                                      cardIds: next,
                                    });
                                  }}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="cms-btn"
                                  disabled={
                                    i === selectedCollection.cardIds.length - 1
                                  }
                                  aria-label={`Move ${id} down`}
                                  onClick={() => {
                                    const next = [
                                      ...selectedCollection.cardIds,
                                    ];
                                    [next[i + 1], next[i]] = [
                                      next[i],
                                      next[i + 1],
                                    ];
                                    setSelectedCollection({
                                      ...selectedCollection,
                                      cardIds: next,
                                    });
                                  }}
                                >
                                  ↓
                                </button>
                              </div>
                            ))}
                            <div className="cms-checklist">
                              {collectionCards
                                .filter(
                                  (c) =>
                                    c.publication !== "archived" ||
                                    selectedCollection.cardIds.includes(c.id),
                                )
                                .map((c) => (
                                  <label className="cms-checkbox" key={c.id}>
                                    <input
                                      type="checkbox"
                                      checked={selectedCollection.cardIds.includes(
                                        c.id,
                                      )}
                                      onChange={(e) =>
                                        setSelectedCollection({
                                          ...selectedCollection,
                                          cardIds: e.target.checked
                                            ? [
                                                ...selectedCollection.cardIds,
                                                c.id,
                                              ]
                                            : selectedCollection.cardIds.filter(
                                                (id) => id !== c.id,
                                              ),
                                        })
                                      }
                                    />
                                    {c.name} · {c.set} · {c.condition}
                                  </label>
                                ))}
                            </div>
                          </div>
                        </div>
                        <div className="cms-actions" style={{ marginTop: 20 }}>
                          <button className="cms-btn cms-btn-primary">
                            Save collection
                          </button>
                          <button
                            className="cms-btn"
                            type="button"
                            onClick={() => setSelectedCollection(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  ) : (
                    collections.map((c) => (
                      <section className="cms-panel cms-title" key={c.id}>
                        <div>
                          <h2>{c.name}</h2>
                          <p>
                            {c.cardIds.length} listings · Position {c.sortOrder}
                          </p>
                        </div>
                        <button
                          className="cms-btn"
                          onClick={() => setSelectedCollection(c)}
                        >
                          Edit collection
                        </button>
                      </section>
                    ))
                  )}
                </>
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
              {(props.view === "content" || props.view === "settings") && (
                <form
                  className="cms-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      () =>
                        saveSettings(draftSettings, props.settingsUpdatedAt),
                      "Changes saved.",
                    );
                  }}
                >
                  <fieldset disabled={busy}>
                    <h2>
                      {props.view === "content"
                        ? "Website copy"
                        : "Store configuration"}
                    </h2>
                    {props.view === "content" ? (
                      <div className="cms-grid">
                        {Object.entries(draftSettings.content).map(
                          ([key, value]) => (
                            <label
                              key={key}
                              className={`cms-field ${["aboutBody", "storeDescription", "heroSubtitle", "footerDescription"].includes(key) ? "cms-wide" : ""}`}
                            >
                              {
                                (
                                  {
                                    heroLine1: "Hero title · line 1",
                                    heroLine2: "Hero title · line 2",
                                    heroSubtitle: "Hero subtitle",
                                    heroCta: "Hero button text",
                                    aboutTitle: "About title",
                                    aboutBody: "About description",
                                    footerTitle: "Footer title",
                                    footerDescription: "Footer introduction",
                                    storeDescription: "Store description",
                                    contactEmail: "Contact email",
                                    location: "Location",
                                  } as Record<string, string>
                                )[key]
                              }
                              {[
                                "aboutBody",
                                "storeDescription",
                                "heroSubtitle",
                                "footerDescription",
                              ].includes(key) ? (
                                <textarea
                                  value={value}
                                  onChange={(e) =>
                                    setDraftSettings({
                                      ...draftSettings,
                                      content: {
                                        ...draftSettings.content,
                                        [key]: e.target.value,
                                      },
                                    })
                                  }
                                />
                              ) : (
                                <input
                                  type={
                                    key === "contactEmail" ? "email" : "text"
                                  }
                                  required
                                  maxLength={
                                    key.startsWith("heroLine") ? 22 : undefined
                                  }
                                  value={value}
                                  onChange={(e) =>
                                    setDraftSettings({
                                      ...draftSettings,
                                      content: {
                                        ...draftSettings.content,
                                        [key]: e.target.value,
                                      },
                                    })
                                  }
                                />
                              )}
                            </label>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="cms-grid">
                        <label className="cms-field">
                          Store currency
                          <select
                            disabled={user.role !== "owner"}
                            value={draftSettings.currency}
                            onChange={(e) =>
                              setDraftSettings({
                                ...draftSettings,
                                currency: e.target
                                  .value as StoreSettings["currency"],
                              })
                            }
                          >
                            <option value="">Choose currency</option>
                            {[
                              "AUD",
                              "USD",
                              "PHP",
                              "GBP",
                              "EUR",
                              "CAD",
                              "NZD",
                              "JPY",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          <small>
                            Existing numeric prices are not converted. Confirm
                            their intended currency before saving.
                          </small>
                        </label>
                        <label className="cms-field">
                          Unpaid hold duration (hours)
                          <input
                            type="number"
                            min={1}
                            max={720}
                            disabled={user.role !== "owner"}
                            value={draftSettings.holdDurationHours}
                            onChange={(e) =>
                              setDraftSettings({
                                ...draftSettings,
                                holdDurationHours: Number(e.target.value),
                              })
                            }
                          />
                          <small>
                            Newly accepted unpaid holds expire after this
                            period. Existing holds are unchanged.
                          </small>
                        </label>
                        <label className="cms-checkbox cms-setting-toggle cms-wide">
                          <input
                            type="checkbox"
                            disabled={user.role !== "owner"}
                            checked={draftSettings.holdsEnabled}
                            onChange={(e) =>
                              setDraftSettings({
                                ...draftSettings,
                                holdsEnabled: e.target.checked,
                              })
                            }
                          />
                          Accept hold requests
                        </label>
                        <p className="cms-wide cms-muted">
                          Hold policy: customers submit a request; an
                          administrator confirms and reserves stock. Payment is
                          only available after Stripe is configured and the
                          payment migration is applied.
                        </p>
                        <div
                          className="cms-wide cms-integration-status"
                          data-status={stripeReady ? "ready" : "unavailable"}
                        >
                          <strong>
                            Stripe payments:{" "}
                            {stripeReady ? "configured" : "foundation only"}
                          </strong>
                          <span>
                            {stripeReady
                              ? "Accepted customers can open secure card checkout."
                              : "Add the server-only Stripe keys and webhook secret before enabling online payment."}
                          </span>
                        </div>
                      </div>
                    )}
                    <button
                      className="cms-btn cms-btn-primary"
                      style={{ marginTop: 24 }}
                    >
                      Save {props.view === "content" ? "content" : "settings"}
                    </button>
                  </fieldset>
                </form>
              )}
              {props.view === "settings" && user.role === "owner" && (
                <section className="cms-panel">
                  <h2>Administrator access</h2>
                  <p className="cms-muted">
                    Owners manage access and store settings. Editors manage
                    cards, content, and requests.
                  </p>
                  {props.admins.map((a) => (
                    <div
                      className="cms-title"
                      key={a.user_id}
                      style={{ margin: "18px 0" }}
                    >
                      <div>
                        {a.email}
                        <small
                          className="cms-muted"
                          style={{ display: "block" }}
                        >
                          {a.role} · {a.active ? "Active" : "Disabled"}
                        </small>
                      </div>
                      {a.user_id !== user.id && (
                        <div className="cms-actions">
                          <button
                            disabled={busy}
                            className="cms-btn"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Change ${a.email} to ${a.role === "owner" ? "editor" : "owner"}?`,
                                )
                              )
                                void run(
                                  () =>
                                    setAdmin({
                                      userId: a.user_id,
                                      email: a.email,
                                      role:
                                        a.role === "owner" ? "editor" : "owner",
                                      active: a.active,
                                    }),
                                  "Access updated.",
                                );
                            }}
                          >
                            Make {a.role === "owner" ? "editor" : "owner"}
                          </button>
                          <button
                            disabled={busy}
                            className="cms-btn"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${a.active ? "Disable" : "Enable"} access for ${a.email}?`,
                                )
                              )
                                void run(
                                  () =>
                                    setAdmin({
                                      userId: a.user_id,
                                      email: a.email,
                                      role: a.role,
                                      active: !a.active,
                                    }),
                                  "Access updated.",
                                );
                            }}
                          >
                            {a.active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(
                        () => inviteAdmin(invite),
                        "Invitation sent with editor access.",
                      );
                    }}
                  >
                    <label className="cms-field">
                      Invite an editor
                      <input
                        type="email"
                        value={invite}
                        onChange={(e) => setInvite(e.target.value)}
                        required
                        placeholder="name@example.com"
                      />
                    </label>
                    <button
                      className="cms-btn"
                      disabled={busy}
                      style={{ marginTop: 12 }}
                    >
                      Send invitation
                    </button>
                  </form>
                  <details>
                    <summary>Add an existing Supabase account</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          () =>
                            setAdmin({
                              userId: existingId,
                              email: invite,
                              role: "editor",
                              active: true,
                            }),
                          "Editor access granted.",
                        );
                      }}
                    >
                      <label className="cms-field">
                        Existing user ID
                        <input
                          value={existingId}
                          onChange={(e) => setExistingId(e.target.value)}
                          required
                        />
                      </label>
                      <label className="cms-field">
                        Email
                        <input
                          type="email"
                          value={invite}
                          onChange={(e) => setInvite(e.target.value)}
                          required
                        />
                      </label>
                      <button
                        className="cms-btn"
                        disabled={busy}
                        style={{ marginTop: 12 }}
                      >
                        Grant editor access
                      </button>
                    </form>
                  </details>
                </section>
              )}
              {props.view === "activity" && (
                <section className="cms-panel">
                  <h2>Latest 100 changes</h2>
                  {!props.audit.length && <p className="cms-empty">No changes recorded yet. Saved updates to your store will appear here.</p>}
                  {props.audit.map((a) => (
                    <article
                      key={a.id}
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "14px 0",
                      }}
                    >
                      <strong>
                        {a.table_name} · {a.record_id}
                      </strong>
                      <p className="cms-muted">
                        {new Date(a.created_at).toLocaleString("en-GB", {
                          timeZone: "UTC",
                        })}{" "}
                        UTC ·{" "}
                        {a.actor_id
                          ? props.admins.find((u) => u.user_id === a.actor_id)
                              ?.email || a.actor_id
                          : "System / migration"}
                      </p>
                      <details>
                        <summary>View previous and saved values</summary>
                        <div className="cms-grid">
                          <div>
                            <h3>Before</h3>
                            <pre>{JSON.stringify(a.old_data, null, 2)}</pre>
                          </div>
                          <div>
                            <h3>After</h3>
                            <pre>{JSON.stringify(a.new_data, null, 2)}</pre>
                          </div>
                        </div>
                      </details>
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
