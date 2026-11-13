export type HoldNotificationKind =
  | "customer_request_received"
  | "customer_status_changed"
  | "staff_request_received";

export type HoldNotificationPayload = {
  holdId?: string | null;
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
  items: { cardId: string; name: string; priceCents: number; set?: string | null; number?: string | null }[];
  note?: string | null;
  /** Set when the hold's status changed in this update. */
  statusChanged?: boolean;
  /** Set when this update recorded the refund. */
  refundedNow?: boolean;
  createdAt?: string;
  expiresAt?: string | null;
  paidAt?: string | null;
};

export type HoldEmailVariant =
  | "received"
  | "reserved"
  | "paid"
  | "ready"
  | "shipped"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired"
  | "refunded"
  | "staff";

type RenderOptions = { siteUrl?: string; now?: number };

// Brand tokens, mirrored from app/globals.css.
const INK = "#1a1a1a";
const YELLOW = "#fedd25";
const BLUE = "#3194ee";
const PINK = "#ffd6e0";
const CREAM = "#fff6e0";
const PASTEL_YELLOW = "#fff3b8";
const PASTEL_BLUE = "#d6eaff";
const MUTED = "#4a4a4a";
const BODY_FONT = "Fredoka, 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif";
const PIXEL_FONT = "'Press Start 2P', 'Courier New', monospace";
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

function pretty(value: string | null | undefined) {
  return (value || "pending").replaceAll("_", " ");
}

function money(currency: string, cents: number) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function siteUrl(options: RenderOptions) {
  return (options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://www.binderfinders.com").replace(/\/+$/, "");
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function timeLeft(deadline: string, now: number) {
  const minutes = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 60_000));
  const [value, unit] =
    minutes >= 1440 ? [Math.floor(minutes / 1440), "day"]
      : minutes >= 60 ? [Math.floor(minutes / 60), "hour"]
        : [minutes, "minute"];
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

/** Picks which design a notification uses from its kind and the hold's state. */
export function holdEmailVariant(kind: HoldNotificationKind, payload: HoldNotificationPayload): HoldEmailVariant {
  if (kind === "staff_request_received") return "staff";
  if (kind === "customer_request_received") return "received";
  const fulfillment = payload.fulfillmentStatus || "not_ready";
  // Newer payloads say what changed. A hold closed after an earlier refund
  // gets the closing email, not the refund email again. Older payloads
  // (without the flag) keep the previous behaviour.
  const refundIsNews = payload.refundedNow ?? (payload.statusChanged ? false : true);
  if (payload.paymentStatus === "refunded" && refundIsNews) return "refunded";
  if (payload.status === "rejected") return "declined";
  if (payload.status === "cancelled") return "cancelled";
  if (payload.status === "expired") return "expired";
  if (payload.status === "completed" || fulfillment === "delivered" || fulfillment === "picked_up") return "completed";
  if (fulfillment === "shipped") return "shipped";
  if (payload.paymentStatus === "paid" && fulfillment === "ready") return "ready";
  if (payload.paymentStatus === "paid") return "paid";
  if (payload.status === "accepted") return "reserved";
  return "received";
}

// ── Building blocks (table layout and inline styles for email clients) ────

function chip(label: string, dark = true) {
  return `<span style="display:inline-block;font-family:${PIXEL_FONT};font-size:10px;letter-spacing:1px;line-height:1.4;background:${dark ? INK : YELLOW};color:${dark ? YELLOW : INK};padding:7px 10px;border-radius:8px">${escapeHtml(label)}</span>`;
}

function hero(options: { band: string; sprite: number; site: string; chip: string; heading: string; dark?: boolean }) {
  const headingColor = options.dark ? YELLOW : INK;
  const ring = options.dark ? "#ffffff" : INK;
  const spriteBg = options.dark ? YELLOW : "#ffffff";
  return `<tr><td style="background:${options.band};border-bottom:3px solid ${INK};padding:28px 32px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="102" valign="middle" style="padding-right:20px"><div style="width:96px;height:96px;background:${spriteBg};border:3px solid ${ring};border-radius:50%;text-align:center;line-height:96px"><img src="${options.site}/sprites/gen3/${options.sprite}.png" width="84" height="84" alt="" style="vertical-align:middle;image-rendering:pixelated"></div></td>
<td valign="middle">${chip(options.chip, !options.dark)}<h1 style="margin:10px 0 0;font-family:${BODY_FONT};font-size:32px;line-height:1.1;font-weight:600;color:${headingColor}">${escapeHtml(options.heading)}</h1></td>
</tr></table></td></tr>`;
}

function intro(greeting: string, body: string) {
  return `<p style="margin:0 0 8px;font-size:18px;font-weight:600">${escapeHtml(greeting)}</p><p style="margin:0;font-size:16px;line-height:1.55">${escapeHtml(body)}</p>`;
}

function stepper(labels: string[], done: number, current: number, highlight: string) {
  const cells = labels.map((label, i) => {
    const isDone = i < done;
    const fill = isDone ? YELLOW : i === current ? highlight : "#ffffff";
    const mark = isDone ? "&#10003;" : String(i + 1);
    const weight = i === current || (current < 0 && i === labels.length - 1) ? 600 : 400;
    return `<td align="center" valign="top" width="20%"><div style="width:24px;height:24px;line-height:24px;border:3px solid ${INK};border-radius:50%;background:${fill};font-size:13px;font-weight:600;text-align:center;margin:0 auto">${mark}</div><div style="margin-top:8px;font-size:13px;font-weight:${weight}">${escapeHtml(label)}</div></td>`;
  });
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cells.join("")}</tr></table>`;
}

function label(text: string) {
  return `<div style="font-family:${PIXEL_FONT};font-size:10px;letter-spacing:1px;margin:0 0 10px">${escapeHtml(text)}</div>`;
}

function cardDetail(item: HoldNotificationPayload["items"][number]) {
  return [item.set, item.number].filter(Boolean).join(" · ");
}

function cardsTable(payload: HoldNotificationPayload, totalLabel: string, options: { heading?: string; header?: string; extraRows?: string; muted?: boolean } = {}) {
  const rows = payload.items.map((item) => {
    const detail = cardDetail(item);
    return `<tr><td style="padding:14px 18px;border-bottom:2px dashed ${INK}"><div style="font-size:16px;font-weight:600">${escapeHtml(item.name)}</div>${detail ? `<div style="font-size:13px;color:${MUTED};margin-top:2px">${escapeHtml(detail)}</div>` : ""}</td><td align="right" style="padding:14px 18px;border-bottom:2px dashed ${INK};font-size:16px;font-weight:${options.muted ? 400 : 600};color:${options.muted ? MUTED : INK};white-space:nowrap">${escapeHtml(money(payload.currency, item.priceCents))}</td></tr>`;
  });
  const header = options.header
    ? `<tr><td colspan="2" style="background:${INK};color:${YELLOW};padding:12px 18px;font-family:${PIXEL_FONT};font-size:10px;letter-spacing:1px">${escapeHtml(options.header)}</td></tr>`
    : "";
  const total = `<tr><td style="padding:14px 18px;background:${options.muted ? "#f3f0e6" : PASTEL_YELLOW};font-size:16px;font-weight:600">${escapeHtml(totalLabel)}</td><td align="right" style="padding:14px 18px;background:${options.muted ? "#f3f0e6" : PASTEL_YELLOW};font-size:18px;font-weight:600;white-space:nowrap">${escapeHtml(money(payload.currency, payload.totalCents))}</td></tr>`;
  return `${options.heading ? label(options.heading) : ""}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:3px solid ${INK};border-radius:16px;border-collapse:separate;overflow:hidden">${header}${rows.join("")}${total}${options.extraRows || ""}</table>`;
}

function box(background: string, inner: string, extraStyle = "") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${background};border:3px solid ${INK};border-radius:16px;border-collapse:separate${extraStyle}"><tr><td style="padding:18px 20px">${inner}</td></tr></table>`;
}

function button(href: string, text: string, full = false) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"${full ? ' width="100%"' : ""}><tr><td align="center" style="background:${INK};border-radius:999px;box-shadow:4px 4px 0 ${BLUE}"><a href="${escapeHtml(href)}" style="display:block;padding:16px 30px;font-family:${BODY_FONT};font-size:17px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(text)}</a></td></tr></table>`;
}

function small(text: string) {
  return `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${MUTED};text-align:center">${escapeHtml(text)}</p>`;
}

function section(inner: string) {
  return `<tr><td style="padding:24px 32px 0">${inner}</td></tr>`;
}

function shell(options: { site: string; preheader: string; hero: string; sections: string[]; footer: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&amp;family=Press+Start+2P&amp;display=swap"><title>BinderFinders</title></head>
<body style="margin:0;padding:0;background:${YELLOW};color:${INK};font-family:${BODY_FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${YELLOW}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px">
<tr><td align="center" style="padding-bottom:24px"><a href="${options.site}"><img src="${options.site}/images/logo.png" width="300" height="44" alt="BinderFinders" style="display:block;border:0;width:300px;max-width:100%;height:auto"></a></td></tr>
<tr><td style="background:#ffffff;border:3px solid ${INK};border-radius:22px;box-shadow:6px 6px 0 ${INK};overflow:hidden">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:${BODY_FONT};color:${INK}">
${options.hero}
${options.sections.map(section).join("\n")}
<tr><td style="padding:32px 0 0"></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${INK}">${options.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function customerFooter(site: string, ordered: boolean) {
  return `<strong>BinderFinders · Vintage Pokémon cards · Melbourne, Australia</strong><br>You're getting this because you ${ordered ? "placed an order" : "requested a hold"} at <a href="${site}" style="color:${INK};font-weight:600">binderfinders.com</a>.`;
}

// ── Variants ──────────────────────────────────────────────────────────────

type Rendered = { subject: string; text: string; html: string };

export function renderHoldNotification(
  kind: HoldNotificationKind,
  payload: HoldNotificationPayload,
  options: RenderOptions = {},
): Rendered {
  const variant = holdEmailVariant(kind, payload);
  const site = siteUrl(options);
  const now = options.now ?? Date.now();
  const ref = payload.reference;
  const orderUrl = payload.holdId ? `${site}/account/orders/${encodeURIComponent(payload.holdId)}` : `${site}/account/orders`;
  const adminUrl = payload.holdId ? `${site}/admin?view=holds&hold=${encodeURIComponent(payload.holdId)}` : `${site}/admin?view=holds`;
  const steps = ["Requested", "Reserved", "Paid", "Packed", "Shipped"];
  const total = money(payload.currency, payload.totalCents);
  const cardLines = payload.items.map((item) => {
    const detail = cardDetail(item);
    return `- ${item.name}${detail ? ` (${detail})` : ""}: ${money(payload.currency, item.priceCents)}`;
  }).join("\n");
  const firstName = payload.name.trim().split(/\s+/)[0] || payload.name;
  const note = payload.fulfillmentNote?.trim() || "";
  const replyLine = "Questions? Just reply to this email.";

  const text = (lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join("\n\n");

  if (variant === "staff") {
    const received = payload.createdAt ? formatDeadline(payload.createdAt) : "";
    const stats = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="33%" style="padding-right:8px"><div style="border:3px solid ${INK};border-radius:14px;padding:14px"><div style="font-size:13px;color:${MUTED}">Cards</div><div style="font-size:24px;font-weight:600">${payload.items.length}</div></div></td>
<td width="34%" style="padding:0 4px"><div style="border:3px solid ${INK};border-radius:14px;padding:14px;background:${PASTEL_YELLOW}"><div style="font-size:13px;color:${MUTED}">Total</div><div style="font-size:20px;font-weight:600;white-space:nowrap">${escapeHtml(total)}</div></div></td>
<td width="33%" style="padding-left:8px"><div style="border:3px solid ${INK};border-radius:14px;padding:14px"><div style="font-size:13px;color:${MUTED}">Received</div><div style="font-size:15px;font-weight:600;line-height:1.3">${escapeHtml(received || "Just now")}</div></div></td>
</tr></table>`;
    const customer = `${label("CUSTOMER")}${box("#ffffff", `<div style="font-size:17px;font-weight:600">${escapeHtml(payload.name)}</div><div style="margin-top:4px"><a href="mailto:${escapeHtml(payload.email)}" style="font-size:15px;color:${INK}">${escapeHtml(payload.email)}</a></div><div style="margin-top:4px;font-size:13px;color:${MUTED}">Verified customer account</div>`)}`;
    const message = payload.note?.trim()
      ? box(PINK, `<div style="font-size:15px;font-weight:600">Message from the customer</div><div style="margin-top:6px;font-size:15px;line-height:1.5;white-space:pre-line">${escapeHtml(payload.note.trim())}</div>`)
      : "";
    return {
      subject: `New card hold request #${ref}`,
      html: shell({
        site,
        preheader: `${payload.name} requested ${payload.items.length} card${payload.items.length === 1 ? "" : "s"} (${total}).`,
        hero: hero({ band: BLUE, sprite: 129, site, chip: `STORE ALERT · #${ref}`, heading: "New hold request" }),
        sections: [stats, customer, message, cardsTable(payload, "Total", { heading: "REQUESTED CARDS" }), `${button(adminUrl, "Review in the store manager", true)}${small("These cards stay on sale until you accept the request.")}`].filter(Boolean),
        footer: "<strong>BinderFinders store alerts</strong><br>Sent to the order alerts email set in Settings › Order alerts.",
      }),
      text: text([
        "New hold request",
        `Reference: ${ref}`,
        `Customer: ${payload.name} (${payload.email})`,
        payload.note?.trim() && `Message: ${payload.note.trim()}`,
        `Cards:\n${cardLines}`,
        `Total: ${total}`,
        `Review it in the store manager: ${adminUrl}`,
        "These cards stay on sale until you accept the request.",
      ]),
    };
  }

  if (variant === "received") {
    const updated = kind === "customer_status_changed";
    return {
      subject: updated ? `Your BinderFinders request #${ref} was updated` : `We got your BinderFinders request #${ref}`,
      html: shell({
        site,
        preheader: "We're checking your cards now. Nothing is charged yet.",
        hero: hero({ band: BLUE, sprite: 25, site, chip: `REQUEST #${ref}`, heading: updated ? "Your request was updated" : "We got your request!" }),
        sections: [
          intro(`Hi ${firstName},`, "Thanks for your hold request. We're checking these cards now and will email you as soon as they're reserved for you. Nothing is charged yet."),
          stepper(steps, 0, 0, BLUE),
          cardsTable(payload, "Total", { heading: "YOUR CARDS" }),
          box(PASTEL_BLUE, `<div style="font-size:16px;font-weight:600">What happens next</div><div style="margin-top:8px;font-size:15px;line-height:1.5">1. We confirm your cards and reserve them.<br>2. You get an email with a secure link to pay.<br>3. We pack your cards and send pickup or tracking details.</div>`),
          `${button(orderUrl, "View your request")}${small(replyLine)}`,
        ],
        footer: customerFooter(site, false),
      }),
      text: text([
        updated ? "Your request was updated" : "We got your request!",
        `Hi ${firstName},`,
        "Thanks for your hold request. We're checking these cards now and will email you as soon as they're reserved for you. Nothing is charged yet.",
        `Reference: ${ref}`,
        `Cards:\n${cardLines}`,
        `Total: ${total}`,
        "What happens next:\n1. We confirm your cards and reserve them.\n2. You get an email with a secure link to pay.\n3. We pack your cards and send pickup or tracking details.",
        `View your request: ${orderUrl}`,
        replyLine,
      ]),
    };
  }

  if (variant === "reserved") {
    const deadline = payload.expiresAt ? formatDeadline(payload.expiresAt) : "";
    const left = payload.expiresAt ? timeLeft(payload.expiresAt, now) : "";
    const sticker = box(YELLOW, `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td valign="middle"><div style="font-family:${PIXEL_FONT};font-size:10px;letter-spacing:1px">HOLD ENDS</div><div style="margin-top:6px;font-size:22px;font-weight:600">${escapeHtml(deadline || "See your order")}</div>${left ? `<div style="margin-top:4px;font-size:13px">Melbourne time · ${escapeHtml(left)} left</div>` : ""}</td><td align="right" valign="middle" style="font-size:24px;font-weight:600;white-space:nowrap">${escapeHtml(total)}</td></tr></table>`);
    return {
      subject: `Your cards are reserved: pay for request #${ref}`,
      html: shell({
        site,
        preheader: deadline ? `Pay before ${deadline} to keep your cards.` : "Pay before your hold ends to keep your cards.",
        hero: hero({ band: PINK, sprite: 385, site, chip: `REQUEST #${ref}`, heading: "Your cards are reserved!" }),
        sections: [
          intro(`Good news, ${firstName}!`, "We've checked your cards and set them aside just for you. Pay before your hold ends and we'll start packing."),
          stepper(steps, 1, 1, PINK),
          sticker,
          `${button(orderUrl, "Pay securely with Stripe", true)}${small("Card payments are handled by Stripe. We never see your card details.")}`,
          cardsTable(payload, "Total", { heading: "RESERVED FOR YOU" }),
          small("If the hold ends before payment, the cards go back on sale. Need more time? Reply and we'll see what we can do."),
        ],
        footer: customerFooter(site, false),
      }),
      text: text([
        "Your cards are reserved!",
        `Good news, ${firstName}! We've checked your cards and set them aside just for you.`,
        deadline && `Pay before: ${deadline} (Melbourne time, ${left} left)`,
        `Reference: ${ref}`,
        `Cards:\n${cardLines}`,
        `Total: ${total}`,
        `Pay securely with Stripe: ${orderUrl}`,
        "If the hold ends before payment, the cards go back on sale. Need more time? Reply and we'll see what we can do.",
      ]),
    };
  }

  if (variant === "paid") {
    const paidOn = payload.paidAt ? formatDay(payload.paidAt) : "";
    const details = `<tr><td colspan="2" style="padding:14px 18px;font-size:14px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${paidOn ? `<td width="50%"><div style="color:${MUTED}">Paid on</div><div style="font-weight:600">${escapeHtml(paidOn)}</div></td>` : ""}<td><div style="color:${MUTED}">Payment reference</div><div style="font-weight:600">${escapeHtml(payload.paymentReference || ref)}</div></td></tr></table></td></tr>`;
    return {
      subject: `Payment received for request #${ref}`,
      html: shell({
        site,
        preheader: "Your payment went through. We're packing your cards next.",
        hero: hero({ band: PASTEL_YELLOW, sprite: 6, site, chip: `REQUEST #${ref}`, heading: "Payment received, thank you!" }),
        sections: [
          intro(`You're all set, ${firstName}.`, "Your payment went through and your cards are yours. We're packing them next and will email you pickup or tracking details."),
          stepper(steps, 3, 3, PASTEL_YELLOW),
          cardsTable(payload, "Paid", { header: "RECEIPT", extraRows: details }),
          `${button(orderUrl, "Track your order")}${small("Keep this email as your receipt. Questions? Just reply.")}`,
        ],
        footer: customerFooter(site, true),
      }),
      text: text([
        "Payment received, thank you!",
        `You're all set, ${firstName}. Your payment went through and your cards are yours. We're packing them next.`,
        `Reference: ${ref}`,
        `Cards:\n${cardLines}`,
        `Paid: ${total}`,
        paidOn && `Paid on: ${paidOn}`,
        `Track your order: ${orderUrl}`,
        "Keep this email as your receipt.",
      ]),
    };
  }

  if (variant === "ready" || variant === "shipped") {
    const shipped = variant === "shipped";
    const heading = shipped ? "Your cards are on the way!" : "Your cards are ready!";
    const body = shipped
      ? "Your cards are sleeved, top-loaded and in the post. Here's how to follow them home."
      : "Your cards are sleeved, top-loaded and ready. Here are the handover details.";
    const noteBox = box(PASTEL_BLUE, `${label(shipped ? "TRACKING" : "HANDOVER DETAILS")}<div style="font-size:17px;line-height:1.5;font-weight:500;white-space:pre-line">${escapeHtml(note || "We'll be in touch with the details shortly.")}</div>`);
    return {
      subject: shipped ? `Your BinderFinders order #${ref} has shipped` : `Your BinderFinders order #${ref} is ready`,
      html: shell({
        site,
        preheader: shipped ? "Your cards are in the post." : "Your cards are packed and ready.",
        hero: hero({ band: PASTEL_BLUE, sprite: 257, site, chip: `REQUEST #${ref}`, heading }),
        sections: [
          intro(`Hi ${firstName},`, body),
          stepper([...steps.slice(0, 4), shipped ? "Shipped" : "Ready"], 4, 4, PASTEL_BLUE),
          noteBox,
          cardsTable(payload, "Paid", { heading: "IN THIS ORDER" }),
          `${button(orderUrl, "View your order")}${small("Something not right? Just reply to this email.")}`,
        ],
        footer: customerFooter(site, true),
      }),
      text: text([
        heading,
        `Hi ${firstName}, ${body}`,
        note && `${shipped ? "Tracking" : "Handover details"}: ${note}`,
        `Reference: ${ref}`,
        `Cards:\n${cardLines}`,
        `View your order: ${orderUrl}`,
        replyLine,
      ]),
    };
  }

  if (variant === "completed") {
    const last = payload.fulfillmentStatus === "picked_up" ? "Picked up" : "Delivered";
    return {
      subject: `Your BinderFinders order #${ref} is complete`,
      html: shell({
        site,
        preheader: "Your order is complete. Enjoy your new cards!",
        hero: hero({ band: INK, sprite: 25, site, chip: `ORDER #${ref} · COMPLETE`, heading: "Enjoy your new cards!", dark: true }),
        sections: [
          intro(`That's a wrap, ${firstName}.`, "Your order is complete. Thanks for collecting with BinderFinders. We hope these cards look great in your binder."),
          stepper([...steps.slice(0, 4), last], 5, -1, YELLOW),
          cardsTable(payload, "Paid"),
          box(PINK, `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td valign="middle"><div style="font-size:18px;font-weight:600">Hunting for the next one?</div><div style="margin-top:6px;font-size:14px;line-height:1.5">Every listing is flatbed scanned, so you see the real card.</div></td><td align="right" valign="middle" style="padding-left:16px"><a href="${site}/shop" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 22px;border-radius:999px;white-space:nowrap">Shop cards</a></td></tr></table>`),
          small("Something not right with your order? Just reply to this email."),
        ],
        footer: customerFooter(site, true),
      }),
      text: text([
        "Enjoy your new cards!",
        `That's a wrap, ${firstName}. Your order is complete. Thanks for collecting with BinderFinders.`,
        `Reference: ${ref}`,
        `Cards:\n${cardLines}`,
        `Paid: ${total}`,
        `Shop more cards: ${site}/shop`,
        replyLine,
      ]),
    };
  }

  // Declined, cancelled, expired or refunded.
  const closed = {
    declined: {
      chip: "DECLINED",
      heading: "We couldn't hold these cards",
      body: "Sorry, we weren't able to reserve the cards in your request this time. Nothing was charged.",
      detail: "A card may have sold elsewhere or no longer meets our condition standards. Your request is closed.",
      totalLabel: "Requested total",
      cta: "Browse other cards",
      href: `${site}/shop`,
    },
    cancelled: {
      chip: "CANCELLED",
      heading: "Your request was cancelled",
      body: "Your hold request has been cancelled and nothing was charged.",
      detail: "The cards are back on sale for everyone. If you didn't mean to cancel, reply and we'll check if they're still available.",
      totalLabel: "Requested total",
      cta: "Browse cards",
      href: `${site}/shop`,
    },
    expired: {
      chip: "EXPIRED",
      heading: "Your hold has ended",
      body: "The time to pay for this hold ran out, so we've released the cards. Nothing was charged.",
      detail: "The cards are back on sale. If they are still available you can request them again from the shop.",
      totalLabel: "Requested total",
      cta: "Request them again",
      href: `${site}/shop`,
    },
    refunded: {
      chip: "REFUNDED",
      heading: "Your refund is on its way",
      body: "We've refunded your payment for this order in full.",
      detail: "Refunds usually reach your card in 5 to 10 business days, depending on your bank.",
      totalLabel: "Refunded",
      cta: "View your order",
      href: orderUrl,
    },
  }[variant];
  return {
    subject: variant === "refunded" ? `Refund for BinderFinders order #${ref}` : `Your BinderFinders request #${ref} is ${closed.chip.toLowerCase()}`,
    html: shell({
      site,
      preheader: closed.body,
      hero: hero({ band: CREAM, sprite: 202, site, chip: `REQUEST #${ref} · ${closed.chip}`, heading: closed.heading }),
      sections: [
        intro(`Hi ${firstName},`, closed.body),
        box(CREAM, `${label("WHAT THIS MEANS")}<div style="font-size:15px;line-height:1.5">${escapeHtml(closed.detail)}</div>`),
        cardsTable(payload, closed.totalLabel, { heading: "CARDS IN THIS REQUEST", muted: true }),
        note ? box("#ffffff", `<div style="font-size:15px;font-weight:600">A note from the store</div><div style="margin-top:6px;font-size:15px;line-height:1.5;white-space:pre-line">${escapeHtml(note)}</div>`) : "",
        `${button(closed.href, closed.cta)}${small("Questions about this? Just reply to this email.")}`,
      ].filter(Boolean),
      footer: customerFooter(site, variant === "refunded"),
    }),
    text: text([
      closed.heading,
      `Hi ${firstName}, ${closed.body}`,
      closed.detail,
      note && `Note from the store: ${note}`,
      `Reference: ${ref}`,
      `Cards:\n${cardLines}`,
      `${closed.totalLabel}: ${total}`,
      `Status: ${pretty(payload.status)} · Payment: ${pretty(payload.paymentStatus)}`,
      `${closed.cta}: ${closed.href}`,
    ]),
  };
}
