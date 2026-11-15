import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BagProvider } from "../../bag/BagContext";
import { CheckoutMartClient, holdNote } from "../CheckoutMartClient";
import { SHOP_CARDS } from "../../../lib/data";
const mockPush = jest.fn();
jest.mock('next/navigation',()=>({useRouter:()=>({refresh:jest.fn(),push:mockPush})}));
let mockCurrency = 'AUD';
jest.mock('../../CatalogProvider',()=>({useCatalog:()=>({cards:require('../../../lib/data').SHOP_CARDS,settings:{...require('../../../lib/cms/types').defaultSettings,holdsEnabled:true,guestCheckoutEnabled:true,currency:mockCurrency}})}));

/**
 * CheckoutMartClient — bag-driven, responsive, functional checkout.
 */

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

function renderWithBag(ui: React.ReactElement) {
  return render(<BagProvider>{ui}</BagProvider>);
}

const testCustomer = { email: "ash@example.com", name: "" };

beforeEach(() => {
  mockCurrency = 'AUD';
  mockPush.mockClear();
  localStorage.clear();
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({reference:'12345678-1234-4234-8234-123456789012'})});
  Object.defineProperty(global.crypto,'randomUUID',{value:()=> '12345678-1234-4234-8234-123456789012',configurable:true});
});

afterEach(() => {
  localStorage.clear();
});

describe("CheckoutMartClient", () => {
  it.each(['', 'AUD', 'PHP'])('uses only the configured currency (%s) for totals and items', currency => {
    mockCurrency = currency;
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    const expected = currency ? `${currency} 8,500` : '8,500';
    expect(document.querySelector('[data-checkout-total]')?.textContent?.trim()).toBe(expected);
    const item = document.querySelector('[data-checkout-item="true"]');
    expect(item?.textContent).toContain(expected);
    expect(item?.textContent).not.toContain('$');
  });

  it('labels selected cards as in the bag, not already on hold', () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(screen.getByText('1 Item in bag')).toBeInTheDocument();
    expect(screen.queryByText(/\bon hold\b/i)).not.toBeInTheDocument();
  });

  it('labels an empty bag without implying a reservation', () => {
    renderWithBag(<CheckoutMartClient customer={testCustomer} />);
    expect(screen.getByText('0 Items in bag')).toBeInTheDocument();
  });

  it("renders an empty-bag state when no items", () => {
    renderWithBag(<CheckoutMartClient customer={testCustomer} />);
    expect(screen.getByText(/empty|no items|your bag is empty/i)).toBeInTheDocument();
  });

  it("seeds a card from ?card= when bag is empty", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(screen.getByText("Charizard")).toBeInTheDocument();
  });

  it("renders bag items with prices", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    // The item appears in a checkout-item container
    const item = document.querySelector('[data-checkout-item="true"]');
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain("8,500");
  });

  it("renders a total based on bag contents", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    const totalEl = document.querySelector("[data-checkout-total]");
    expect(totalEl?.textContent).toContain("8,500");
  });

  it("allows removing an item from the bag", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    const removeBtn = screen.getByRole("button", { name: /remove/i });
    await user.click(removeBtn);

    expect(screen.getByText(/empty|no items|your bag is empty/i)).toBeInTheDocument();
  });

  it("renders contact form fields", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(screen.getByLabelText(/name|full name|contact name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email|e-mail/i)).toBeInTheDocument();
  });

  it("shows the Stripe checkout button for signed-in customers too", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);
    expect(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request hold/i }),
    ).not.toBeInTheDocument();
  });

  it("uses Guest Checkout for a signed-in customer", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "paid",
        orderId: "guest-order-1",
        sessionId: "cs_test_123",
      }),
    });

    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    await user.type(screen.getByLabelText(/name/i), "Ash Ketchum");
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("readonly");

    await user.click(
      screen.getByRole("radio", { name: /pick up in melbourne/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /terms of sale/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/guest-checkout",
      expect.objectContaining({ method: "POST" }),
    );

    expect(
      (global.fetch as jest.Mock).mock.calls.some(
        ([url]) => url === "/api/holds",
      ),
    ).toBe(false);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual(
      expect.objectContaining({
        name: "Ash Ketchum",
        email: "ash@example.com",
        fulfillmentMethod: "pickup",
        shippingAddress: null,
        cardIds: ["charizard-base1"],
      }),
    );

    expect(mockPush).toHaveBeenCalledWith(
      "/checkout?payment=success&guest_order=guest-order-1&session_id=cs_test_123",
    );
  });

  it("prevents checkout while required details are incomplete", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    expect(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    ).toBeDisabled();
  });

  it("keeps the bag when Guest Checkout rejects the request", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "A card price changed. Refresh your bag.",
      }),
    });

    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    await user.type(screen.getByLabelText(/name/i), "Ash");
    await user.click(
      screen.getByRole("radio", { name: /pick up in melbourne/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /terms of sale/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("price changed");
    expect(screen.getByText("Charizard")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("binderfinders:bag:v1") || "[]"),
    ).toContain("charizard-base1");
  });

  it("allows signed-out customers to use Guest Checkout without clearing the bag", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={null} />);

    expect(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in to request/i }),
    ).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem("binderfinders:bag:v1") || "[]"),
    ).toContain("charizard-base1");
  });

  it("uses pickup fulfillment without requiring a shipping address", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "paid",
        orderId: "guest-order-2",
        sessionId: "cs_test_456",
      }),
    });

    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    await user.type(screen.getByLabelText(/name/i), "Ash");
    await user.click(
      screen.getByRole("radio", { name: /pick up in melbourne/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /terms of sale/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.fulfillmentMethod).toBe("pickup");
    expect(body.shippingAddress).toBeNull();
  });

  it("needs the terms box ticked before Stripe checkout can start", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" customer={testCustomer} />);

    await user.type(screen.getByLabelText(/name/i), "Ash");
    await user.click(
      screen.getByRole("radio", { name: /pick up in melbourne/i }),
    );

    expect(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", { name: /terms of sale/i }),
    );

    expect(
      screen.getByRole("button", { name: /pay securely with stripe/i }),
    ).toBeEnabled();
  });

  it("writes a delivery-only note when the customer adds nothing", () => {
    expect(holdNote("post", "   ")).toBe("Delivery: Tracked post");
  });
});
