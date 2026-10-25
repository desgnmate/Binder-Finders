"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Layers, Search } from "lucide-react";
import type { Hold } from "../../lib/cms/types";
import {
  awaitingPayment,
  holdLabel,
  holdRef,
  holdTotal,
  initials,
  storeDate,
  timeUntil,
} from "./presentation";
import { useConfirm } from "./ConfirmDialog";

const paymentStatuses = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
const fulfillmentStatuses = [
  "not_ready",
  "ready",
  "shipped",
  "delivered",
  "picked_up",
  "cancelled",
] as const;
const historyLabels: Record<string, string> = {
  pending: "Request received",
  accepted: "Accepted & reserved",
  completed: "Sale completed",
  rejected: "Request declined",
  cancelled: "Hold cancelled",
  expired: "Hold expired",
};
const actorLabels = { customer: "Customer", admin: "Store", system: "Automatic" };
type Workflow = {
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentReference: string;
  fulfillmentNote: string;
};
function initialWorkflow(hold: Hold): Workflow {
  return {
    paymentStatus: hold.payment_status || "unpaid",
    fulfillmentStatus: hold.fulfillment_status || "not_ready",
    paymentReference: hold.payment_reference || "",
    fulfillmentNote: hold.fulfillment_note || "",
  };
}
function localInput(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}
function WorkflowEditor({
  hold,
  busy,
  onSave,
  onDirtyChange,
  onTransition,
}: {
  hold: Hold;
  busy: boolean;
  onSave: (hold: Hold, values: Record<string, string>) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onTransition: (hold: Hold, status: string) => void;
}) {
  const [draft, setDraft] = useState(() => initialWorkflow(hold));
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(initialWorkflow(hold)),
  );
  const serverSnapshot = JSON.stringify(initialWorkflow(hold));
  useEffect(() => {
    setDraft(JSON.parse(serverSnapshot) as Workflow);
    setBaseline(serverSnapshot);
  }, [serverSnapshot]);
  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const canComplete =
    hold.payment_status === "paid" &&
    ["ready", "shipped", "delivered", "picked_up"].includes(
      hold.fulfillment_status || "",
    ) &&
    !dirty;
  return (
    <form
      className="cms-workflow-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(hold, { ...draft }))
          setBaseline(JSON.stringify(draft));
      }}
    >
      <div className="cms-workflow-columns">
        <fieldset disabled={busy}>
          <legend>Payment</legend>
          <label className="cms-field">
            Payment
            <select
              value={draft.paymentStatus}
              onChange={(e) =>
                setDraft({ ...draft, paymentStatus: e.target.value })
              }
            >
              {paymentStatuses.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="cms-field">
            Payment reference
            <input
              value={draft.paymentReference}
              maxLength={200}
              placeholder="Bank transfer or payment ID"
              onChange={(e) =>
                setDraft({ ...draft, paymentReference: e.target.value })
              }
            />
          </label>
          <p className="cms-field-help">
            Records a payment or refund already handled externally; does not
            charge or refund money.
          </p>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Handover &amp; delivery</legend>
          <label className="cms-field">
            Fulfilment
            <select
              value={draft.fulfillmentStatus}
              onChange={(e) =>
                setDraft({ ...draft, fulfillmentStatus: e.target.value })
              }
            >
              {fulfillmentStatuses.map((value) => (
                <option key={value} value={value}>
                  {(value.charAt(0).toUpperCase() + value.slice(1)).replaceAll(
                    "_",
                    " ",
                  )}
                </option>
              ))}
            </select>
          </label>
          <label className="cms-field">
            Fulfilment note (visible to customer)
            <textarea
              value={draft.fulfillmentNote}
              maxLength={1000}
              placeholder="Pickup details or a delivery tracking reference"
              onChange={(e) =>
                setDraft({ ...draft, fulfillmentNote: e.target.value })
              }
            />
          </label>
        </fieldset>
      </div>
      <div className="cms-hold-footer">
        {hold.status === "accepted" && (
          <button
            type="button"
            className="cms-btn cms-btn-danger"
            disabled={busy || dirty}
            onClick={() => onTransition(hold, "cancelled")}
          >
            Cancel &amp; release
          </button>
        )}
        <p>
          {dirty
            ? "Save your changes before completing or cancelling."
            : hold.status !== "accepted"
              ? "Update payment or delivery details for this request."
              : !canComplete
                ? "Record payment and prepare fulfilment to complete."
                : "Payment recorded. Ready to complete the sale."}
        </p>
        <button className="cms-btn" disabled={busy} aria-label="Save workflow">
          {busy ? "Saving…" : "Save changes"}
        </button>
        {hold.status === "accepted" && (
          <button
            type="button"
            className="cms-btn cms-btn-primary"
            disabled={busy || !canComplete}
            onClick={() => onTransition(hold, "completed")}
          >
            Complete sale
          </button>
        )}
      </div>
    </form>
  );
}

function DeadlineCard({
  hold,
  busy,
  onSave,
}: {
  hold: Hold;
  busy: boolean;
  onSave: (hold: Hold, values: Record<string, string>) => Promise<boolean>;
}) {
  const [expiresAt, setExpiresAt] = useState(() => localInput(hold.expires_at));
  useEffect(() => setExpiresAt(localInput(hold.expires_at)), [hold.expires_at]);
  const changed = expiresAt && expiresAt !== localInput(hold.expires_at);
  return (
    <section className="cms-deadline-card" aria-label="Reservation deadline">
      <span>
        <i />
        Reservation deadline
      </span>
      <div className="cms-deadline-inset">
        <strong>
          {hold.expires_at
            ? storeDate(hold.expires_at, true)
            : "No deadline set"}
        </strong>
        <small suppressHydrationWarning>
          {hold.expires_at
            ? `Expires ${timeUntil(hold.expires_at)} (Melbourne time). Unpaid reservations release the cards automatically.`
            : "Unpaid reservations release the cards automatically."}
        </small>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (changed)
            void onSave(hold, {
              expiresAt: new Date(expiresAt).toISOString(),
            });
        }}
      >
        <label className="cms-field">
          Extend to
          <input
            aria-label="Hold deadline"
            type="datetime-local"
            value={expiresAt}
            disabled={busy}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <small>Up to 30 days. Times use your device&apos;s timezone.</small>
        </label>
        <button className="cms-btn" disabled={busy || !changed}>
          Extend hold
        </button>
      </form>
    </section>
  );
}

export function AdminHolds({
  holds,
  initialHoldId,
  busy,
  onSave,
  onTransition,
  onDirtyChange,
}: {
  holds: Hold[];
  initialHoldId?: string;
  busy: boolean;
  onSave: (hold: Hold, values: Record<string, string>) => Promise<boolean>;
  onTransition: (hold: Hold, status: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(initialHoldId || holds[0]?.id || "");
  const [dirty, setDirty] = useState(false);
  const handledDeepLink = useRef(initialHoldId);
  const detailRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(0);
  const confirm = useConfirm();
  const search = useDeferredValue(query).trim().toLowerCase();
  const filterMatches = (hold: Hold, value: string) =>
    value === "all" ||
    (value === "open"
      ? ["pending", "accepted"].includes(hold.status)
      : value === "closed"
        ? ["cancelled", "rejected", "expired"].includes(hold.status)
        : hold.status === value);
  const visible = useMemo(
    () =>
      holds.filter(
        (h) =>
          filterMatches(h, filter) &&
          `${h.name} ${h.email} ${h.id}`.toLowerCase().includes(search),
      ),
    [holds, filter, search],
  );
  const pageHolds = visible.slice(page * 10, page * 10 + 10);
  // Keep the selected editor mounted while searching. Filtering never discards edits.
  const hold = holds.find((h) => h.id === selected);
  const history = [...(hold?.hold_status_history || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (handledDeepLink.current === initialHoldId || dirty) return;
    if (initialHoldId && holds.some((h) => h.id === initialHoldId))
      setSelected(initialHoldId);
    handledDeepLink.current = initialHoldId;
  }, [initialHoldId, holds, dirty]);
  async function selectHold(id: string) {
    if (busy || id === selected) return;
    if (
      dirty &&
      !(await confirm({
        title: "Discard unsaved changes to this request?",
        body: "Your payment and delivery edits haven't been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "danger",
        icon: "edit",
      }))
    )
      return;
    setDirty(false);
    setSelected(id);
    // On narrow screens the detail sits below the list; bring it into view.
    if (window.matchMedia?.("(max-width: 1100px)").matches)
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView?.({ behavior: "smooth" }),
      );
  }
  const steps = hold
    ? ([
        ["Requested", true],
        ["Accepted", ["accepted", "completed"].includes(hold.status)],
        ["Paid", hold.payment_status === "paid"],
        [
          "Fulfilment",
          ["ready", "shipped", "delivered", "picked_up"].includes(
            hold.fulfillment_status || "",
          ),
        ],
        ["Completed", hold.status === "completed"],
      ] as const)
    : [];
  const closed = hold && ["cancelled", "rejected", "expired"].includes(hold.status);
  const current = closed ? -1 : steps.findIndex(([, done]) => !done);
  return (
    <div className="cms-hold-workspace">
      <section className="cms-request-browser" aria-label="Request list">
        <label className="cms-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Search hold requests"
            placeholder="Name, email or reference"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="cms-filter-pills" aria-label="Filter requests">
          {[
            ["all", "All"],
            ["open", "Open"],
            ["pending", "New"],
            ["completed", "Completed"],
            ["closed", "Closed"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
            >
              {label}{" "}
              <span>{holds.filter((h) => filterMatches(h, value)).length}</span>
            </button>
          ))}
        </div>
        <div className="cms-request-list">
          {pageHolds.map((h) => (
            <button
              key={h.id}
              type="button"
              className="cms-request-summary"
              aria-pressed={selected === h.id}
              disabled={busy}
              onClick={() => void selectHold(h.id)}
            >
              <span className="cms-request-top">
                <span
                  className="cms-avatar"
                  data-tone={selected === h.id ? undefined : "soft"}
                  aria-hidden="true"
                >
                  {initials(h.name)}
                </span>
                <span>
                  <strong>{h.name}</strong>
                  <small>
                    {storeDate(h.created_at)} · {h.hold_request_items.length}{" "}
                    {h.hold_request_items.length === 1 ? "card" : "cards"}
                  </small>
                </span>
              </span>
              <span className="cms-request-meta">
                <span className="cms-badge" data-status={h.status}>
                  {holdLabel(h)}
                </span>
                <strong className="cms-money">{holdTotal(h)}</strong>
              </span>
            </button>
          ))}
          {!visible.length && (
            <div className="cms-empty cms-empty-compact">
              <span className="cms-empty-icon">
                <Inbox size={22} />
              </span>
              <p>
                {holds.length
                  ? "No requests match this search."
                  : "No requests yet."}
              </p>
            </div>
          )}
        </div>
        {visible.length > 10 && (
          <div className="cms-request-pagination">
            <button
              className="cms-btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              {page + 1} / {Math.ceil(visible.length / 10)}
            </span>
            <button
              className="cms-btn"
              disabled={(page + 1) * 10 >= visible.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
        <small className="cms-muted">Showing the latest 200 requests.</small>
      </section>
      {hold ? (
        <>
          <section
            ref={detailRef}
            className="cms-request-detail"
            aria-label={`Request from ${hold.name}`}
          >
            <header className="cms-request-head">
              <span className="cms-avatar" data-size="lg" aria-hidden="true">
                {initials(hold.name)}
              </span>
              <div>
                <h2>{hold.name}</h2>
                <a href={`mailto:${hold.email}`}>{hold.email}</a>
                <small>
                  Requested {storeDate(hold.created_at, true)} (Melbourne) · Ref{" "}
                  {holdRef(hold)}
                </small>
              </div>
              <div className="cms-request-total">
                <span className="cms-badge" data-status={hold.status}>
                  {holdLabel(hold)}
                </span>
                <span>Order total</span>
                <strong>{holdTotal(hold)}</strong>
              </div>
              <ol className="cms-progress" aria-label="Order progress">
                {steps.map(([label, done], i) => (
                  <li
                    key={label}
                    data-state={done ? "done" : i === current ? "current" : "todo"}
                  >
                    {label}
                    {i === current ? " · now" : ""}
                  </li>
                ))}
              </ol>
            </header>
            <div className="cms-panel cms-stack">
              <h3>Cards in this request</h3>
              <ul className="cms-request-items">
                {hold.hold_request_items.map((item) => (
                  <li key={item.card_id}>
                    <span className="cms-thumb" aria-hidden="true">
                      <Layers size={16} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.card_id}</small>
                    </div>
                    <span className="cms-money">
                      {hold.currency}{" "}
                      {(item.price_cents / 100).toLocaleString("en-AU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              {hold.note && (
                <div className="cms-customer-note">
                  <strong>Message from customer</strong>
                  <p>{hold.note}</p>
                </div>
              )}
            </div>
            {["accepted", "completed", "cancelled"].includes(hold.status) && (
              <WorkflowEditor
                key={hold.id}
                hold={hold}
                busy={busy}
                onSave={onSave}
                onDirtyChange={setDirty}
                onTransition={onTransition}
              />
            )}
            {hold.status === "pending" && (
              <div className="cms-workflow-form">
                <div className="cms-hold-footer">
                  <p>Accepting reserves these cards for {hold.name}.</p>
                  <button
                    disabled={busy}
                    className="cms-btn cms-btn-danger"
                    onClick={() => onTransition(hold, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    disabled={busy}
                    className="cms-btn cms-btn-primary"
                    onClick={() => onTransition(hold, "accepted")}
                  >
                    Accept &amp; reserve
                  </button>
                </div>
              </div>
            )}
          </section>
          <aside className="cms-hold-rail" aria-label="Request timeline">
            {awaitingPayment(hold) && (
              <DeadlineCard hold={hold} busy={busy} onSave={onSave} />
            )}
            <section className="cms-panel">
              <h2>History</h2>
              {history.length ? (
                <ol className="cms-history">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <i />
                      <span>
                        <strong>
                          {historyLabels[entry.to_status] || entry.to_status}
                        </strong>
                        {entry.note && <small>{entry.note}</small>}
                        <small>
                          {storeDate(entry.created_at, true)} ·{" "}
                          {actorLabels[entry.actor_kind] || entry.actor_kind}
                        </small>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="cms-muted">
                  Requested {storeDate(hold.created_at, true)}.
                </p>
              )}
            </section>
          </aside>
        </>
      ) : (
        <section className="cms-panel cms-empty cms-request-detail">
          <span className="cms-empty-icon">
            <Inbox size={24} />
          </span>
          <h2>Select a request</h2>
          <p>
            Review a customer&apos;s cards, payment, and delivery details here.
          </p>
        </section>
      )}
    </div>
  );
}
