export type HoldNotificationKind =
  | "customer_request_received"
  | "customer_status_changed"
  | "staff_request_received";

export type HoldNotificationPayload = {
  reference: string;
  name: string;
  email: string;
  status: "pending" | "accepted" | "completed" | "rejected" | "cancelled" | "expired";
  currency: string;
  totalCents: number;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  paymentReference?: string | null;
  fulfillmentNote?: string | null;
  items: { cardId: string; name: string; priceCents: number }[];
  note?: string | null;
  createdAt?: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] || character,
  );
}

function pretty(value: string | null | undefined) {
  return (value || "pending").replaceAll("_", " ");
}

function money(payload: HoldNotificationPayload) {
  return `${payload.currency} ${(payload.totalCents / 100).toFixed(2)}`;
}

function itemLines(payload: HoldNotificationPayload) {
  return payload.items
    .map(
      (item) =>
        `${item.name} — ${payload.currency} ${(item.priceCents / 100).toFixed(2)}`,
    )
    .join("\n");
}

function itemHtml(payload: HoldNotificationPayload) {
  return payload.items
    .map(
      (item) =>
        `<li style="margin:0 0 8px">${escapeHtml(item.name)} <span style="color:#666">— ${escapeHtml(payload.currency)} ${(item.priceCents / 100).toFixed(2)}</span></li>`,
    )
    .join("");
}

export function renderHoldNotification(
  kind: HoldNotificationKind,
  payload: HoldNotificationPayload,
) {
  const isStaff = kind === "staff_request_received";
  const isNew = kind === "customer_request_received" || isStaff;
  const subject = isStaff
    ? `New card hold request #${payload.reference}`
    : isNew
      ? `We received your BinderFinders request #${payload.reference}`
      : `BinderFinders request #${payload.reference} updated`;
  const heading = isStaff
    ? "New hold request"
    : isNew
      ? "We received your request"
      : "Your request has been updated";
  const greeting = isStaff ? "A customer has requested these cards." : `Hi ${payload.name},`;
  const detail = isStaff
    ? `Customer: ${payload.name} (${payload.email})`
    : `Current status: ${pretty(payload.status)}`;
  const footer = isStaff
    ? "Review this request in the BinderFinders admin area before contacting the customer."
    : "We will contact you with the next steps. Please keep this reference for your records.";
  const text = [
    heading,
    greeting,
    detail,
    `Reference: ${payload.reference}`,
    `Cards:\n${itemLines(payload)}`,
    `Total: ${money(payload)}`,
    `Payment: ${pretty(payload.paymentStatus)}`,
    `Fulfilment: ${pretty(payload.fulfillmentStatus)}`,
    payload.fulfillmentNote ? `Fulfilment note: ${payload.fulfillmentNote}` : "",
    payload.note ? `Note: ${payload.note}` : "",
    footer,
  ]
    .filter(Boolean)
    .join("\n\n");
  const html = `<!doctype html><html><body style="margin:0;background:#fff6e0;color:#1a1a1a;font-family:Arial,sans-serif"><div style="max-width:600px;margin:24px auto;padding:28px;background:#fff;border:2px solid #1a1a1a;border-radius:18px"><h1 style="margin:0 0 18px;font-size:28px">${escapeHtml(heading)}</h1><p>${escapeHtml(greeting)}</p><p>${escapeHtml(detail)}</p><p><strong>Reference:</strong> ${escapeHtml(payload.reference)}<br><strong>Total:</strong> ${escapeHtml(money(payload))}<br><strong>Payment:</strong> ${escapeHtml(pretty(payload.paymentStatus))}<br><strong>Fulfilment:</strong> ${escapeHtml(pretty(payload.fulfillmentStatus))}</p><h2 style="font-size:18px">Cards</h2><ul>${itemHtml(payload)}</ul>${payload.note ? `<p><strong>Note:</strong> ${escapeHtml(payload.note)}</p>` : ""}<p>${escapeHtml(footer)}</p></div></body></html>`;
  const withFulfillmentNote = payload.fulfillmentNote
    ? html.replace("<h2", `<p><strong>Fulfilment note:</strong> ${escapeHtml(payload.fulfillmentNote)}</p><h2`)
    : html;
  return { subject, text, html: withFulfillmentNote };
}
