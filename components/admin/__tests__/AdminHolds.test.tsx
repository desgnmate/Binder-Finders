import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminHolds, canDeleteHold, customerMessage } from "../AdminHolds";
import type { Hold } from "../../../lib/cms/types";

function hold(overrides: Partial<Hold> = {}): Hold {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Ash Ketchum",
    email: "ash@example.test",
    note: "",
    status: "pending",
    currency: "AUD",
    created_at: "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    hold_request_items: [{ request_id: "a", card_id: "charizard-base1", name: "Charizard", price_cents: 125000 }],
    hold_status_history: [],
    ...overrides,
  } as Hold;
}

const props = { busy: false, onSave: jest.fn(), onTransition: jest.fn(), onDirtyChange: jest.fn() };

describe("Admin hold requests", () => {
  it("shows where a posted hold is going", () => {
    render(
      <AdminHolds
        {...props}
        holds={[
          hold({
            note: "Delivery: Tracked post\nAsh Ketchum\n1 Pallet St\nFitzroy VIC 3065\nAustralia\n\nCorner photos please",
            delivery: { method: "post", recipient: "Ash Ketchum", phone: "0400 000 000", line1: "1 Pallet St", line2: "", suburb: "Fitzroy", state: "VIC", postcode: "3065", country: "Australia" },
          }),
        ]}
      />,
    );
    const panel = document.querySelector("[data-hold-delivery]") as HTMLElement;
    expect(panel).toHaveTextContent("1 Pallet St");
    expect(panel).toHaveTextContent("Fitzroy VIC 3065");
    expect(panel).toHaveTextContent("Phone 0400 000 000");
    // The address isn't repeated in the customer's message.
    expect(screen.getByText("Corner photos please")).toBeInTheDocument();
  });

  it("explains when an older hold has no address", () => {
    render(<AdminHolds {...props} holds={[hold({ note: "Delivery: Tracked post" })]} />);
    expect(screen.getByText(/no address on file/i)).toBeInTheDocument();
    expect(screen.getByText("Delivery: Tracked post")).toBeInTheDocument();
  });

  it("deletes a request that never became a sale", async () => {
    const onDelete = jest.fn();
    render(<AdminHolds {...props} onDelete={onDelete} holds={[hold({ status: "rejected" })]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /delete request/i }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected" }));
  });

  it("keeps sales and paid requests", () => {
    expect(canDeleteHold(hold({ status: "pending" }))).toBe(true);
    expect(canDeleteHold(hold({ status: "cancelled", payment_status: "failed" }))).toBe(true);
    expect(canDeleteHold(hold({ status: "accepted" }))).toBe(false);
    expect(canDeleteHold(hold({ status: "completed", payment_status: "paid" }))).toBe(false);
    expect(canDeleteHold(hold({ status: "cancelled", payment_status: "refunded" }))).toBe(false);
    render(<AdminHolds {...props} onDelete={jest.fn()} holds={[hold({ status: "completed", payment_status: "paid" })]} />);
    expect(screen.queryByRole("button", { name: /delete request/i })).not.toBeInTheDocument();
  });

  it("leaves a customer's message alone when there's no saved address", () => {
    expect(customerMessage(hold({ note: "Delivery: Tracked post\n\nHi" }))).toBe("Delivery: Tracked post\n\nHi");
  });
});

describe("Admin hold list paging", () => {
  it("steps back a page when the last request on it goes away", () => {
    const many = Array.from({ length: 11 }, (_, i) =>
      hold({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`, name: `Collector ${i}` }),
    );
    const { rerender } = render(<AdminHolds {...props} holds={many} />);
    screen.getByRole("button", { name: "Next" }).click();
    return Promise.resolve().then(() => {
      rerender(<AdminHolds {...props} holds={many.slice(0, 10)} />);
      expect(screen.getAllByText(/^Collector \d+$/).length).toBeGreaterThan(0);
    });
  });
});

describe("Admin hold links", () => {
  it("switches back to a linked request after another one was opened", async () => {
    const first = hold({ name: "First buyer" });
    const second = hold({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Second buyer" });
    const { rerender } = render(<AdminHolds {...props} holds={[first, second]} initialHoldId={first.id} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Second buyer/ }));
    expect(screen.getByRole("region", { name: "Request from Second buyer" })).toBeInTheDocument();
    expect(window.location.search).toContain(`hold=${second.id}`);
    // The address bar now names the second request; a link to the first changes it back.
    rerender(<AdminHolds {...props} holds={[first, second]} initialHoldId={second.id} />);
    rerender(<AdminHolds {...props} holds={[first, second]} initialHoldId={first.id} />);
    expect(screen.getByRole("region", { name: "Request from First buyer" })).toBeInTheDocument();
  });
});
