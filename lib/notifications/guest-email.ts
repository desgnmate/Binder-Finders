export type GuestPurchaseNotificationPayload = {
  orderId: string;
  name: string;
  email: string;
  fulfillmentMethod: string;
  shippingAddress?: Record<string, unknown> | null;
  currency: string;
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  shippingService?: string | null;
  insuranceSelected: boolean;
  insuranceFeeCents: number;
  paidAt?: string | null;
  items: {
    cardId: string;
    name: string;
    priceCents: number;
  }[];
};

type RenderedGuestPurchaseEmail = {
  subject: string;
  html: string;
  text: string;
};

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://www.binderfinders.com").replace(
    /\/+$/,
    "",
  );

const TIME_ZONE = "Australia/Melbourne";

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

function money(currency: string, cents: number) {
  return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
}

function formatPaidAt(value?: string | null) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Just now";

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

function formatShippingAddress(
  address?: Record<string, unknown> | null,
) {
  if (!address) return "";

  const preferredKeys = [
    "name",
    "line1",
    "line2",
    "city",
    "state",
    "postal_code",
    "postalCode",
    "country",
  ];

  const seen = new Set<string>();
  const parts: string[] = [];

  for (const key of preferredKeys) {
    const value = address[key];
    if (typeof value !== "string") continue;

    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;

    seen.add(clean);
    parts.push(clean);
  }

  return parts.join(", ");
}

export function renderGuestPurchaseNotification(
  payload: GuestPurchaseNotificationPayload,
): RenderedGuestPurchaseEmail {
  const shortRef = payload.orderId.slice(0, 8).toUpperCase();
  const total = money(payload.currency, payload.totalCents);
  const paidAt = formatPaidAt(payload.paidAt);
  const shippingAddress = formatShippingAddress(payload.shippingAddress);
  const fulfillment = payload.fulfillmentMethod.replaceAll("_", " ");
  const shippingService = payload.shippingService?.replaceAll("_", " ") || "";
  const insurance = payload.insuranceSelected
    ? `Yes (${money(payload.currency, payload.insuranceFeeCents)})`
    : "No";

  const itemRows = payload.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #ddd;font-size:15px">
            ${escapeHtml(item.name)}
          </td>
          <td align="right" style="padding:12px 14px;border-bottom:1px solid #ddd;font-size:15px;white-space:nowrap">
            ${escapeHtml(money(payload.currency, item.priceCents))}
          </td>
        </tr>`,
    )
    .join("");

  const cardLines = payload.items
    .map(
      (item) =>
        `- ${item.name}: ${money(payload.currency, item.priceCents)}`,
    )
    .join("\n");

  const adminUrl = `${SITE_URL}/admin`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BinderFinders purchase alert</title>
</head>
<body style="margin:0;padding:0;background:#fedd25;color:#1a1a1a;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#fff;border:3px solid #1a1a1a;border-radius:18px">
          <tr>
            <td style="padding:24px;background:#3194ee;border-bottom:3px solid #1a1a1a">
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">
                Store Alert · Order ${escapeHtml(shortRef)}
              </div>
              <h1 style="margin:8px 0 0;font-size:28px">
                New paid Guest Checkout order
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:24px">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.5">
                A Guest Checkout payment has been confirmed and the cards are marked sold.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px">
                <tr>
                  <td style="padding:6px 0"><strong>Customer</strong></td>
                  <td align="right">${escapeHtml(payload.name)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0"><strong>Email</strong></td>
                  <td align="right"><a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></td>
                </tr>
                <tr>
                  <td style="padding:6px 0"><strong>Paid</strong></td>
                  <td align="right">${escapeHtml(paidAt)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0"><strong>Fulfillment</strong></td>
                  <td align="right">${escapeHtml(fulfillment)}</td>
                </tr>
                ${
                  shippingService
                    ? `<tr><td style="padding:6px 0"><strong>Shipping service</strong></td><td align="right">${escapeHtml(shippingService)}</td></tr>`
                    : ""
                }
                ${
                  shippingAddress
                    ? `<tr><td style="padding:6px 0;vertical-align:top"><strong>Ship to</strong></td><td align="right" style="padding-left:20px">${escapeHtml(shippingAddress)}</td></tr>`
                    : ""
                }
                <tr>
                  <td style="padding:6px 0"><strong>Insurance</strong></td>
                  <td align="right">${escapeHtml(insurance)}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid #1a1a1a;border-collapse:separate;border-radius:12px;overflow:hidden">
                <tr>
                  <td colspan="2" style="padding:10px 14px;background:#1a1a1a;color:#fedd25;font-size:12px;font-weight:700">
                    PURCHASED CARDS
                  </td>
                </tr>
                ${itemRows}
                <tr>
                  <td style="padding:14px;font-size:16px;font-weight:700;background:#fff3b8">Total paid</td>
                  <td align="right" style="padding:14px;font-size:18px;font-weight:700;background:#fff3b8;white-space:nowrap">
                    ${escapeHtml(total)}
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;text-align:center">
                <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">
                  Open store manager
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "New paid Guest Checkout order",
    `Order: ${shortRef}`,
    `Customer: ${payload.name}`,
    `Email: ${payload.email}`,
    `Paid: ${paidAt}`,
    `Fulfillment: ${fulfillment}`,
    shippingService && `Shipping service: ${shippingService}`,
    shippingAddress && `Ship to: ${shippingAddress}`,
    `Insurance: ${insurance}`,
    `Cards:\n${cardLines}`,
    `Total paid: ${total}`,
    `Store manager: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject: `New paid Guest Checkout order #${shortRef} · ${total}`,
    html,
    text,
  };
}