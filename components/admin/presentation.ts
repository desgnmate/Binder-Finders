import type { Hold } from "../../lib/cms/types";

export function holdTotal(hold: Hold) {
  return `${hold.currency} ${new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(
    hold.hold_request_items.reduce((sum, item) => sum + item.price_cents, 0) /
      100,
  )}`;
}

export function holdLabel(hold: Hold) {
  if (hold.status === "pending") return "New request";
  if (hold.status === "accepted") {
    if (hold.payment_status === "paid") return "Paid · awaiting fulfilment";
    if (hold.payment_status === "refunded") return "Refund recorded";
    if (hold.payment_status === "failed") return "Payment failed";
    return "Accepted · awaiting payment";
  }
  return hold.status.charAt(0).toUpperCase() + hold.status.slice(1);
}

export function storeDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime
      ? { hour: "numeric" as const, minute: "2-digit" as const }
      : {}),
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export function slugify(value: string, maxLength: number) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}

// Admin sub-states (editor open, list filter) live in the query string so the
// browser back button and refresh behave as expected. Next keeps
// useSearchParams in sync with these native history calls.
export function updateQuery(
  changes: Record<string, string | null>,
  mode: "push" | "replace" = "replace",
) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  window.history[mode === "push" ? "pushState" : "replaceState"](
    null,
    "",
    `?${params}`,
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

export function holdRef(hold: Pick<Hold, "id">) {
  const ref = hold.id.slice(0, 8).toUpperCase();
  return `${ref.slice(0, 4)} ${ref.slice(4)}`;
}

// "in 5 hours", "in 2 days", "overdue": coarse on purpose, for scanning.
export function timeUntil(value: string, now = Date.now()) {
  const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
  if (minutes <= 0) return "overdue";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `in ${Math.round(hours / 24)} days`;
}

export function timeAgo(value: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// Calendar day in the store's timezone, as YYYY-MM-DD.
export function storeDay(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export function holdTotalCents(hold: Hold) {
  return hold.hold_request_items.reduce((sum, item) => sum + item.price_cents, 0);
}

export function awaitingPayment(hold: Hold) {
  return (
    hold.status === "accepted" &&
    !["paid", "refunded"].includes(hold.payment_status || "unpaid")
  );
}
