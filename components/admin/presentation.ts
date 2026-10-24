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
