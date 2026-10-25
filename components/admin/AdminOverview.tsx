import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  CircleAlert,
  CheckCircle2,
  FilePen,
  Inbox,
  Type,
} from "lucide-react";
import type {
  AdminDashboardStats,
  Hold,
  StoreSettings,
} from "../../lib/cms/types";
import { holdLabel, holdTotal, storeDate } from "./presentation";

export function AdminOverview({
  stats,
  holds,
  settings,
  stripeReady,
}: {
  stats: AdminDashboardStats;
  holds: Hold[];
  settings: StoreSettings;
  stripeReady: boolean;
}) {
  const attention = holds.filter(
    (h) => h.status === "pending" || h.status === "accepted",
  );
  const first = attention[0];
  const metrics = [
    [
      "available",
      "Available",
      stats.available,
      "Published and ready to request",
    ],
    [
      "reserved",
      "On hold",
      stats.reserved ?? 0,
      "Cards reserved for collectors",
    ],
    [
      "draft",
      "Drafts",
      stats.drafts,
      stats.drafts
        ? "Listings waiting to publish"
        : "Nothing waiting to publish",
    ],
    [
      "sold",
      "Sold",
      stats.sold,
      stats.sold ? "Cards with a new collector" : "No completed sales yet",
    ],
  ] as const;
  return (
    <div className="cms-overview">
      <section className="cms-attention" aria-labelledby="attention-title">
        <div className="cms-attention-heading">
          {first ? <CircleAlert size={19} /> : <CheckCircle2 size={19} />}
          <h2 id="attention-title">
            {first ? "Needs your attention" : "You're up to date"}
          </h2>
          <span>
            {attention.length
              ? `${attention.length} recent ${attention.length === 1 ? "request" : "requests"}`
              : "Recent requests"}
          </span>
        </div>
        <div className="cms-attention-body">
          <div>
            <strong>
              {first
                ? `${first.name} · ${holdLabel(first).toLowerCase()}`
                : "No recent requests waiting for action."}
            </strong>
            {first ? (
              <>
                <p>
                  {first.hold_request_items.map((i) => i.name).join(", ")} ·{" "}
                  <b>{holdTotal(first)}</b> · Ref{" "}
                  {first.id.slice(0, 8).toUpperCase()}
                </p>
                {first.status === "accepted" &&
                  first.expires_at &&
                  first.payment_status !== "paid" && (
                    <p className="cms-deadline">
                      <Clock3 size={15} /> Hold deadline:{" "}
                      {storeDate(first.expires_at, true)} (Melbourne)
                    </p>
                  )}
              </>
            ) : (
              <p>
                Keep your listings fresh, or review your full request history.
              </p>
            )}
          </div>
          <Link
            className="cms-btn cms-btn-dark"
            href={
              first ? `/admin?view=holds&hold=${first.id}` : "/admin?view=holds"
            }
          >
            {first ? "Review hold" : "View requests"} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <div className="cms-stats">
        {metrics.map(([filter, label, count, description]) => (
          <Link
            className="cms-stat"
            key={filter}
            href={`/admin?view=cards&filter=${filter}`}
            aria-label={`${count} ${label.toLowerCase()} · view cards`}
          >
            <span>
              {label} <ArrowRight size={14} />
            </span>
            <strong>{count}</strong>
            <small>{description}</small>
          </Link>
        ))}
      </div>
      <div className="cms-overview-columns">
        <section className="cms-panel">
          <div className="cms-section-heading">
            <h2>Recent requests</h2>
            <Link href="/admin?view=holds">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {holds.length ? (
            <div className="cms-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Cards</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.slice(0, 5).map((h) => (
                    <tr key={h.id}>
                      <td>
                        <Link
                          className="cms-row-link"
                          href={`/admin?view=holds&hold=${h.id}`}
                        >
                          {h.name}
                        </Link>
                        <small>
                          {storeDate(h.created_at)} · Ref{" "}
                          {h.id.slice(0, 8).toUpperCase()}
                        </small>
                      </td>
                      <td>{h.hold_request_items.length}</td>
                      <td className="cms-money">{holdTotal(h)}</td>
                      <td>
                        <span className="cms-badge" data-status={h.status}>
                          {holdLabel(h)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="cms-empty">New customer requests will appear here.</p>
          )}
        </section>
        <section className="cms-panel cms-quick-actions">
          <h2>Quick actions</h2>
          <ul>
            {(
              [
                [
                  "/admin?view=holds",
                  Inbox,
                  "Respond to requests",
                  stats.newRequests
                    ? `${stats.newRequests} new waiting`
                    : "Nothing new right now",
                ],
                [
                  "/admin?view=cards&filter=draft",
                  FilePen,
                  "Finish drafts",
                  stats.drafts
                    ? `${stats.drafts} ready to publish`
                    : "No drafts waiting",
                ],
                [
                  "/admin?view=collections",
                  BookOpen,
                  "Organise collections",
                  "Group cards for collectors",
                ],
                [
                  "/admin?view=content",
                  Type,
                  "Edit website content",
                  "Homepage, about and footer",
                ],
              ] as const
            ).map(([href, Icon, label, hint]) => (
              <li key={href}>
                <Link href={href}>
                  <Icon size={18} />
                  <span>
                    {label}
                    <small>{hint}</small>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="cms-panel cms-store-summary">
        <h2>Store settings</h2>
        <dl>
          <div>
            <dt>Currency</dt>
            <dd>{settings.currency || "Not configured"}</dd>
          </div>
          <div>
            <dt>Hold requests</dt>
            <dd>
              {settings.holdsEnabled ? "On · you accept each one" : "Off"}
            </dd>
          </div>
          <div>
            <dt>Payments</dt>
            <dd>
              {stripeReady ? "Stripe checkout configured" : "Arranged manually"}
            </dd>
          </div>
        </dl>
        <Link href="/admin?view=settings">
          Edit settings <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
