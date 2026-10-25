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
