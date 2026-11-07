import { holdEmailVariant, renderHoldNotification, type HoldNotificationPayload } from "../hold-email";

const site = "https://shop.example.test";
const payload: HoldNotificationPayload = {
  holdId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reference: "ABC12345",
  name: "A <Collector>",
  email: "collector@example.test",
  status: "accepted",
  currency: "AUD",
  totalCents: 8500,
  paymentStatus: "unpaid",
  fulfillmentStatus: "not_ready",
  items: [{ cardId: "charizard-base1", name: "Charizard", priceCents: 8500, set: "Base Set", number: "4/102" }],
  note: "Please send corner photos.",
  expiresAt: "2026-11-06T10:00:00Z",
};
const render = (kind: Parameters<typeof renderHoldNotification>[0], overrides: Partial<HoldNotificationPayload> = {}) =>
  renderHoldNotification(kind, { ...payload, ...overrides }, { siteUrl: site, now: Date.parse("2026-11-04T10:00:00Z") });

describe("hold notification emails", () => {
  it.each([
    [{ status: "pending" }, "received"],
    [{ status: "accepted", paymentStatus: "unpaid" }, "reserved"],
    [{ status: "accepted", paymentStatus: "failed" }, "reserved"],
    [{ status: "accepted", paymentStatus: "paid" }, "paid"],
    [{ status: "accepted", paymentStatus: "paid", fulfillmentStatus: "ready" }, "ready"],
    [{ status: "accepted", paymentStatus: "paid", fulfillmentStatus: "shipped" }, "shipped"],
    [{ status: "completed", paymentStatus: "paid", fulfillmentStatus: "ready" }, "completed"],
    [{ status: "accepted", paymentStatus: "paid", fulfillmentStatus: "picked_up" }, "completed"],
    [{ status: "rejected" }, "declined"],
    [{ status: "cancelled" }, "cancelled"],
    [{ status: "expired" }, "expired"],
    [{ status: "cancelled", paymentStatus: "refunded" }, "refunded"],
  ] as const)("picks the design for %j", (state, variant) => {
    expect(holdEmailVariant("customer_status_changed", { ...payload, ...state })).toBe(variant);
  });

  it("uses the received and staff designs for new requests", () => {
    expect(holdEmailVariant("customer_request_received", payload)).toBe("received");
    expect(holdEmailVariant("staff_request_received", payload)).toBe("staff");
  });

  it("escapes customer text in every part of the email", () => {
    const email = render("staff_request_received", { note: "<script>alert(1)</script>" });
    expect(email.html).toContain("A &lt;Collector&gt;");
    expect(email.html).not.toContain("<Collector>");
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("<script>alert(1)</script>");
  });

  it("links the reserved email to the order and shows the deadline", () => {
    const email = render("customer_status_changed");
    expect(email.subject).toBe("Your cards are reserved: pay for request #ABC12345");
    expect(email.html).toContain(`${site}/account/orders/${payload.holdId}`);
    expect(email.html).toContain("Pay securely with Stripe");
    expect(email.html).toContain("Fri, 6 Nov, 9:00 pm");
    expect(email.html).toContain("2 days left");
    expect(email.text).toContain("Pay before: Fri, 6 Nov, 9:00 pm");
  });

  it("links the store alert to the request in the store manager", () => {
    const email = render("staff_request_received");
    expect(email.subject).toBe("New card hold request #ABC12345");
    expect(email.html).toContain(`${site}/admin?view=holds&amp;hold=${payload.holdId}`);
    expect(email.text).toContain("collector@example.test");
    expect(email.text).toContain("Please send corner photos.");
  });

  it("falls back to the orders list when an older payload has no hold id", () => {
    const email = render("customer_request_received", { holdId: undefined, status: "pending" });
    expect(email.html).toContain(`${site}/account/orders"`);
  });

  it("shows the card set and number when the payload has them", () => {
    expect(render("customer_request_received").html).toContain("Base Set · 4/102");
    expect(render("customer_request_received", { items: [{ cardId: "x", name: "Mew", priceCents: 100 }] }).html).not.toContain(" · undefined");
  });

  it("puts the store's tracking note in the shipped email, escaped", () => {
    const email = render("customer_status_changed", { paymentStatus: "paid", fulfillmentStatus: "shipped", fulfillmentNote: "Tracking <ABC>" });
    expect(email.subject).toBe("Your BinderFinders order #ABC12345 has shipped");
    expect(email.html).toContain("Tracking &lt;ABC&gt;");
    expect(email.html).not.toContain("Tracking <ABC>");
    expect(email.text).toContain("Tracking: Tracking <ABC>");
  });

  it("uses the brand logo and sprites from the site", () => {
    const html = render("customer_request_received", { status: "pending" }).html;
    expect(html).toContain(`${site}/images/logo.png`);
    expect(html).toContain(`${site}/sprites/gen3/25.png`);
  });
});
