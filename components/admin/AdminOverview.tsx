import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartSpline,
  Inbox,
} from "lucide-react";
import type {
  AdminDashboardStats,
  Hold,
  StoreSettings,
} from "../../lib/cms/types";
import {
  awaitingPayment,
  holdLabel,
  holdRef,
  holdTotal,
  initials,
  storeDate,
  storeDay,
  timeUntil,
} from "./presentation";

export type AdminRequestTrend = {
  start: string;
  received: number;
  completed: number;
};

const chart = { width: 560, height: 200, left: 30, bottom: 26, top: 14 };

// Smooth line through the weekly points (Catmull-Rom as cubic Béziers).
function curve(points: [number, number][]) {
  if (points.length < 2) return "";
  let path = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i - 1] || points[i];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[i + 2] || points[i + 1];
    path += ` C${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6}, ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6}, ${x2} ${y2}`;
  }
  return path;
}

function RequestChart({ trend }: { trend: AdminRequestTrend[] }) {
  const max = Math.max(4, ...trend.map((week) => week.received));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const plotWidth = chart.width - chart.left - 12;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const x = (i: number) =>
    chart.left + (trend.length < 2 ? 0 : (i / (trend.length - 1)) * plotWidth);
  const y = (value: number) =>
    chart.top + plotHeight - (value / top) * plotHeight;
  const received = trend.reduce((sum, week) => sum + week.received, 0);
  const completed = trend.reduce((sum, week) => sum + week.completed, 0);
  return (
    <svg
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      role="img"
      aria-label={`${received} requests received over the last 8 weeks, ${completed} of them completed`}
    >
      {[0, 1, 2, 3, 4].map((line) => (
        <g key={line}>
          <line
            x1={chart.left}
            x2={chart.width}
            y1={y(line * step)}
            y2={y(line * step)}
            stroke="#ecedf0"
          />
          <text x="0" y={y(line * step) + 4} fill="#5d636e" fontSize="13">
            {line * step}
          </text>
        </g>
      ))}
      {trend.map((week, i) => (
        <text
          key={week.start}
          x={x(i)}
          y={chart.height - 6}
          fill="#5d636e"
          fontSize="13"
          textAnchor={
            i === 0 ? "start" : i === trend.length - 1 ? "end" : "middle"
          }
        >
          {new Intl.DateTimeFormat("en-AU", {
            day: "numeric",
            month: "short",
            timeZone: "Australia/Melbourne",
          }).format(new Date(week.start))}
        </text>
      ))}
      <path
        d={curve(trend.map((week, i) => [x(i), y(week.completed)]))}
        fill="none"
        stroke="#e0b400"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={curve(trend.map((week, i) => [x(i), y(week.received)]))}
        fill="none"
        stroke="#141517"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {trend.length > 0 && (
        <circle
          cx={x(trend.length - 1)}
          cy={y(trend[trend.length - 1].received)}
          r="5"
          fill="#141517"
          stroke="#fff"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

function WeekStrip({ deadlines }: { deadlines: Hold[] }) {
  const today = storeDay(Date.now());
  // Monday to Sunday around today, built from the store's calendar date.
  const [year, month, day] = today.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    return date.toISOString().slice(0, 10);
  });
  const deadlineDays = new Set(
    deadlines.map((hold) => storeDay(hold.expires_at as string)),
  );
  return (
    <div className="cms-week" aria-hidden="true">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
        <span key={label}>{label}</span>
      ))}
      {days.map((date) => (
        <b
          key={date}
          data-today={date === today}
          data-has-deadline={deadlineDays.has(date)}
        >
          {Number(date.slice(8))}
        </b>
      ))}
    </div>
  );
}

export function AdminOverview({
  stats,
  holds,
  settings,
  stripeReady,
  attention,
  trend = [],
}: {
  stats: AdminDashboardStats;
  holds: Hold[];
  settings: StoreSettings;
  stripeReady: boolean;
  attention?: Hold[];
  trend?: AdminRequestTrend[];
}) {
  // Without the dedicated query, fall back to the open requests in view.
  const open =
    attention ??
    holds.filter((hold) => ["pending", "accepted"].includes(hold.status));
  const deadlines = open
    .filter((hold) => awaitingPayment(hold) && hold.expires_at)
    .sort(
      (a, b) =>
        new Date(a.expires_at as string).getTime() -
        new Date(b.expires_at as string).getTime(),
    );
  const soonest = deadlines[0];
  const urgent =
    soonest &&
    new Date(soonest.expires_at as string).getTime() - Date.now() <
      24 * 3_600_000
      ? soonest
      : undefined;
  const spotlight =
    urgent ||
    open.find((hold) => hold.status === "pending") ||
    soonest ||
    open[0];
  const people = [
    ...new Map(holds.map((hold) => [hold.email, hold])).values(),
  ].slice(0, 4);
  const metrics = [
    ["available", "Available", stats.available, "Published and ready to request"],
    ["reserved", "On hold", stats.reserved ?? 0, "Reserved for collectors"],
    [
      "draft",
      "Drafts",
      stats.drafts,
      stats.drafts ? "Waiting to publish" : "Nothing waiting to publish",
    ],
    [
      "sold",
      "Sold",
      stats.sold,
      stats.sold ? "Cards with new collectors" : "No completed sales yet",
    ],
  ] as const;

  return (
    <div className="cms-overview">
      <div className="cms-overview-main">
        <div className="cms-stats">
          {metrics.map(([filter, label, count, description], i) => (
            <Link
              className="cms-stat"
              data-tone={i === 0 ? "primary" : undefined}
              key={filter}
              href={`/admin?view=cards&filter=${filter}`}
              aria-label={`${count} ${label.toLowerCase()} · view cards`}
            >
              <span>
                {label}
                <span>
                  <ArrowUpRight size={14} />
                </span>
              </span>
              <strong>{count}</strong>
              <small>{description}</small>
            </Link>
          ))}
        </div>

        <section aria-label="Recent hold requests" className="cms-overview-table">
          <div className="cms-tabs">
            <span className="cms-tab" aria-current="true">
              Hold requests
            </span>
            <Link className="cms-tab" href="/admin?view=cards">
              Listings
            </Link>
            <Link className="cms-tab" href="/admin?view=collections">
              Collections
            </Link>
            <Link className="cms-tab cms-tab-end" href="/admin?view=holds">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="cms-panel cms-tabbed">
            {holds.length ? (
              <div className="cms-scroll">
                <table className="cms-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Deadline</th>
                      <th>
                        <span className="cms-visually-hidden">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {holds.slice(0, 5).map((h) => {
                      const selected = h.id === spotlight?.id;
                      return (
                        <tr key={h.id} data-selected={selected}>
                          <td>
                            <div className="cms-card-cell">
                              <span
                                className="cms-avatar"
                                data-tone={selected ? undefined : "soft"}
                                aria-hidden="true"
                              >
                                {initials(h.name)}
                              </span>
                              <div>
                                <strong>{h.name}</strong>
                                <small>
                                  {h.hold_request_items.length}{" "}
                                  {h.hold_request_items.length === 1
                                    ? "card"
                                    : "cards"}{" "}
                                  · {storeDate(h.created_at)}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td className="cms-money">{holdTotal(h)}</td>
                          <td>
                            <span className="cms-badge" data-status={h.status}>
                              {holdLabel(h)}
                            </span>
                          </td>
                          <td suppressHydrationWarning>
                            {awaitingPayment(h) && h.expires_at
                              ? timeUntil(h.expires_at)
                              : h.status === "pending"
                                ? "Not accepted"
                                : "—"}
                          </td>
                          <td className="cms-row-action">
                            <Link
                              className="cms-round"
                              data-tone={selected ? "dark" : undefined}
                              href={`/admin?view=holds&hold=${h.id}`}
                              aria-label={`Open request from ${h.name}`}
                            >
                              <ArrowRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="cms-empty">
                <span className="cms-empty-icon">
                  <Inbox size={24} />
                </span>
                <strong>No hold requests yet</strong>
                <span>
                  When a collector requests cards, it lands here for you to
                  accept or decline.
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="cms-overview-pair">
          <section className="cms-panel cms-chart">
            <div className="cms-section-heading">
              <div>
                <span className="cms-panel-icon">
                  <ChartSpline size={16} />
                </span>
                <h2>Requests</h2>
              </div>
              <div className="cms-chart-legend">
                <span>
                  <i />
                  Received
                </span>
                <span>
                  <i data-series="completed" />
                  Completed
                </span>
                <span>Last 8 weeks</span>
              </div>
            </div>
            <RequestChart trend={trend} />
          </section>
          <section className="cms-panel">
            <div className="cms-section-heading">
              <div>
                <span className="cms-panel-icon">
                  <CalendarDays size={16} />
                </span>
                <h2>Hold deadlines</h2>
              </div>
            </div>
            <WeekStrip deadlines={deadlines} />
            {deadlines.length ? (
              <ul className="cms-deadlines">
                {deadlines.slice(0, 3).map((hold) => (
                  <li key={hold.id}>
                    <Link href={`/admin?view=holds&hold=${hold.id}`}>
                      <i data-urgent={hold.id === urgent?.id} />
                      <span>
                        <strong>{hold.name}</strong>
                        <small>
                          {storeDate(hold.expires_at as string, true)}
                        </small>
                      </span>
                      <b>
                        {hold.hold_request_items.length}{" "}
                        {hold.hold_request_items.length === 1
                          ? "card"
                          : "cards"}
                      </b>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cms-muted">
                No unpaid holds are waiting on a deadline.
              </p>
            )}
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
                {stripeReady
                  ? "Stripe checkout configured"
                  : "Arranged manually"}
              </dd>
            </div>
          </dl>
          <Link href="/admin?view=settings">
            Edit settings <ArrowRight size={15} />
          </Link>
        </section>
      </div>

      <aside className="cms-overview-rail" aria-label="Needs attention">
        {urgent && (
          <Link
            className="cms-alert-card"
            href={`/admin?view=holds&hold=${urgent.id}`}
          >
            {urgent.name}&apos;s hold on{" "}
            <b>
              {urgent.hold_request_items.map((item) => item.name).join(" & ")}
            </b>{" "}
            expires{" "}
            <em suppressHydrationWarning>
              {timeUntil(urgent.expires_at as string)}
            </em>{" "}
            and is still unpaid.
          </Link>
        )}
        {spotlight ? (
          <section className="cms-spotlight" aria-label="Spotlight request">
            <span className="cms-spotlight-tag">
              <i />
              {spotlight.status === "pending"
                ? "Needs a decision"
                : holdLabel(spotlight)}
            </span>
            <div className="cms-spotlight-person">
              <span className="cms-avatar" aria-hidden="true">
                {initials(spotlight.name)}
              </span>
              <div>
                <strong>{spotlight.name}</strong>
                <small>{spotlight.email}</small>
                <small>
                  Ref {holdRef(spotlight)} · {storeDate(spotlight.created_at)}
                </small>
              </div>
            </div>
            <div className="cms-spotlight-inset">
              <span>
                Cards ·{" "}
                <b>
                  {spotlight.hold_request_items
                    .map((item) => item.name)
                    .join(", ")}
                </b>
              </span>
              <div>
                <div>
                  <small>Order total</small>
                  <strong>{holdTotal(spotlight)}</strong>
                </div>
                <Link href={`/admin?view=holds&hold=${spotlight.id}`}>
                  Review hold
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="cms-spotlight" aria-label="Up to date">
            <span className="cms-spotlight-tag">
              <i />
              You&apos;re up to date
            </span>
            <p>No requests are waiting on you. New ones will appear here.</p>
            <Link
              className="cms-btn cms-btn-primary"
              href="/admin?view=cards&action=new"
            >
              Add a card
            </Link>
          </section>
        )}
        {people.length > 0 && (
          <section className="cms-panel">
            <div className="cms-section-heading">
              <h2>Recent customers</h2>
              <Link href="/admin?view=holds">See all</Link>
            </div>
            <div className="cms-people">
              {people.map((hold) => (
                <Link key={hold.id} href={`/admin?view=holds&hold=${hold.id}`}>
                  <span
                    className="cms-avatar"
                    data-tone="soft"
                    aria-hidden="true"
                  >
                    {initials(hold.name)}
                  </span>
                  <span>
                    <strong>{hold.name}</strong>
                    <small>{holdLabel(hold)}</small>
                  </span>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
