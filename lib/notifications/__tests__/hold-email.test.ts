import { renderHoldNotification } from "../hold-email";

const payload = {
  reference: "ABC12345",
  name: "A <Collector>",
  email: "collector@example.test",
  status: "accepted" as const,
  currency: "AUD",
  totalCents: 8500,
  paymentStatus: "pending",
  fulfillmentStatus: "not_ready",
  items: [
    { cardId: "charizard-base1", name: "Charizard", priceCents: 8500 },
  ],
  note: "Please send corner photos.",
};

describe("hold notification emails", () => {
  it("renders safe customer status email content", () => {
    const email = renderHoldNotification("customer_status_changed", payload);
    expect(email.subject).toContain("ABC12345");
    expect(email.text).toContain("Payment: pending");
    expect(email.html).toContain("A &lt;Collector&gt;");
    expect(email.html).not.toContain("<Collector>");
  });

  it("renders a staff request subject", () => {
    const email = renderHoldNotification("staff_request_received", payload);
    expect(email.subject).toBe("New card hold request #ABC12345");
    expect(email.text).toContain("collector@example.test");
  });

  it("includes escaped customer-visible fulfilment notes", () => {
    const email = renderHoldNotification("customer_status_changed", {
      ...payload, fulfillmentNote: "Tracking <ABC>",
    });
    expect(email.text).toContain("Fulfilment note: Tracking <ABC>");
    expect(email.html).toContain("Tracking &lt;ABC&gt;");
    expect(email.html).not.toContain("Tracking <ABC>");
  });
});
