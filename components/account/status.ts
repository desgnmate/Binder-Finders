// Customer-facing labels and chip tones for hold, payment and fulfilment states.
export type ChipTone = "awaiting" | "reserved" | "done" | "closed" | "active" | "failed" | "refunded" | "moving";

export const holdLabels: Record<string, string> = {
  pending: "Awaiting confirmation",
  accepted: "Reserved",
  completed: "Completed",
  rejected: "Not available",
  cancelled: "Cancelled",
  expired: "Expired",
};

const holdTones: Record<string, ChipTone> = {
  pending: "awaiting",
  accepted: "reserved",
  completed: "done",
};

const paymentLabels: Record<string, string> = {
  unpaid: "Unpaid",
  pending: "Checkout open",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const paymentTones: Record<string, ChipTone> = {
  pending: "active",
  paid: "done",
  failed: "failed",
  refunded: "refunded",
};

const fulfilmentTones: Record<string, ChipTone> = {
  not_ready: "closed",
  ready: "moving",
  shipped: "moving",
  delivered: "done",
  picked_up: "done",
  cancelled: "closed",
};

export function holdStatus(status: string) {
  return { label: holdLabels[status] || status, tone: holdTones[status] || "closed" };
}

export function paymentStatus(status: string | null | undefined) {
  const value = status || "unpaid";
  return { label: paymentLabels[value] || value, tone: paymentTones[value] };
}

export function fulfilmentStatus(status: string | null | undefined) {
  const value = status || "not_ready";
  const label = value.replaceAll("_", " ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), tone: fulfilmentTones[value] || "closed" };
}

export function isClosedHold(status: string) {
  return ["rejected", "cancelled", "expired"].includes(status);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export function formatMoney(currency: string, cents: number) {
  return `${currency} ${new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

/** Whole days left before a deadline, counting a partial day as one. */
export function daysLeft(deadline: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 86_400_000));
}
