"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Inbox, Search } from "lucide-react";
import type { Hold } from "../../lib/cms/types";
import { holdLabel, holdTotal, storeDate } from "./presentation";

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
type Workflow = {
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentReference: string;
  fulfillmentNote: string;
  expiresAt: string;
};
function initialWorkflow(hold: Hold): Workflow {
  const date = hold.expires_at ? new Date(hold.expires_at) : null;
  return {
    paymentStatus: hold.payment_status || "unpaid",
    fulfillmentStatus: hold.fulfillment_status || "not_ready",
    paymentReference: hold.payment_reference || "",
    fulfillmentNote: hold.fulfillment_note || "",
    expiresAt:
      date && Number.isFinite(date.getTime())
        ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
  };
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
        const deadlineChanged =
          draft.expiresAt !== initialWorkflow(hold).expiresAt;
        const values = {
          ...draft,
          expiresAt:
            deadlineChanged && draft.expiresAt
              ? new Date(draft.expiresAt).toISOString()
              : "",
        };
        if (await onSave(hold, values)) setBaseline(JSON.stringify(draft));
      }}
    >
      <fieldset disabled={busy}>
        {hold.status === "accepted" &&
          !["paid", "refunded"].includes(draft.paymentStatus) && (
            <div className="cms-hold-deadline">
              <div>
                <strong>
                  <Clock3 size={16} /> Reservation deadline
                </strong>
                <p>
                  {hold.expires_at
                    ? `${storeDate(hold.expires_at, true)} (Melbourne)`
                    : "No deadline set"}
                  . Unpaid reservations expire automatically.
                </p>
              </div>
              <label>
                Extend to (max 30 days)
                <input
                  aria-label="Hold deadline"
                  type="datetime-local"
                  value={draft.expiresAt}
                  onChange={(e) =>
                    setDraft({ ...draft, expiresAt: e.target.value })
                  }
                />
                <small>Times entered in your device&apos;s timezone.</small>
              </label>
            </div>
          )}
        <div className="cms-workflow-columns">
          <section>
            <h3>Payment</h3>
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
                placeholder="Optional — bank transfer or payment ID"
                onChange={(e) =>
                  setDraft({ ...draft, paymentReference: e.target.value })
                }
              />
            </label>
            <p className="cms-muted">
              Records a payment or refund already handled externally; does not
              charge or refund money.
            </p>
          </section>
          <section>
            <h3>Handover & delivery</h3>
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
                    {value.replaceAll("_", " ")}
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
          </section>
        </div>
      </fieldset>
      <div className="cms-hold-footer">
        {hold.status === "accepted" && (
          <button
            type="button"
            className="cms-btn cms-btn-danger"
            disabled={busy || dirty}
            onClick={() => onTransition(hold, "cancelled")}
          >
            Cancel & release
          </button>
        )}
        <div className="cms-hold-save">
          {hold.status === "accepted" && (
            <small>
              {dirty
                ? "Save your changes before completing or cancelling."
                : !canComplete
                  ? "Record payment and prepare fulfilment to complete."
                  : "Payment recorded. Ready to complete the sale."}
            </small>
          )}
          <button
            className="cms-btn"
            disabled={busy}
            aria-label="Save workflow"
          >
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
      </div>
    </form>
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
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (handledDeepLink.current === initialHoldId || dirty) return;
    if (initialHoldId && holds.some((h) => h.id === initialHoldId))
      setSelected(initialHoldId);
    handledDeepLink.current = initialHoldId;
  }, [initialHoldId, holds, dirty]);
  function selectHold(id: string) {
    if (busy || id === selected) return;
    if (dirty && !window.confirm("Discard unsaved changes to this request?"))
      return;
    setDirty(false);
    setSelected(id);
    // On narrow screens the detail sits below the list; bring it into view.
    if (window.matchMedia?.("(max-width: 700px)").matches)
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView?.({ behavior: "smooth" }),
      );
  }
  return (
    <div className="cms-hold-workspace">
      <section className="cms-request-browser" aria-label="Request list">
        <label className="cms-search">
          <Search size={17} />
          <input
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
              onClick={() => selectHold(h.id)}
            >
              <span className="cms-request-top">
                <strong>{h.name}</strong>
                <ArrowRight size={15} />
              </span>
              <small>
                {storeDate(h.created_at)} · Ref {h.id.slice(0, 8).toUpperCase()}
              </small>
              <span>
                {h.hold_request_items.length} cards · <b>{holdTotal(h)}</b>
              </span>
              <span className="cms-badge" data-status={h.status}>
                {holdLabel(h)}
              </span>
            </button>
          ))}
          {!visible.length && (
            <div className="cms-empty">
              <Inbox size={26} />
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
        <section
          ref={detailRef}
          className="cms-request-detail"
          aria-label={`Request from ${hold.name}`}
        >
          <header className="cms-request-detail-heading">
            <div>
              <h2>{hold.name}</h2>
              <span className="cms-badge" data-status={hold.status}>
                {holdLabel(hold)}
              </span>
              <a href={`mailto:${hold.email}`}>{hold.email}</a>
              <small>
                Requested {storeDate(hold.created_at, true)} (Melbourne) · Ref{" "}
                {hold.id.slice(0, 8).toUpperCase()}
              </small>
            </div>
            <div className="cms-request-detail-total">
              <span>Total</span>
              <strong>{holdTotal(hold)}</strong>
            </div>
          </header>
          <div className="cms-request-detail-body">
            <ol className="cms-workflow-progress" aria-label="Order progress">
              {[
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
              ].map(([label, done]) => (
                <li key={String(label)} data-done={done}>
                  <span>{done ? <Check size={12} /> : null}</span>
                  {label}
                </li>
              ))}
            </ol>
            <h3>Cards in this request</h3>
            <ul className="cms-request-items">
              {hold.hold_request_items.map((item) => (
                <li key={item.card_id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.card_id}</small>
                  </div>
                  <span>
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
            <div className="cms-hold-footer">
              <p>Accepting this request reserves its cards.</p>
              <div className="cms-actions">
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
                  Accept & reserve
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="cms-panel cms-empty">
          <Inbox size={32} />
          <h2>Select a request</h2>
          <p>
            Review a customer&apos;s cards, payment, and delivery details here.
          </p>
        </section>
      )}
    </div>
  );
}
