import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BagProvider } from "../../bag/BagContext";
import { CheckoutMartClient } from "../CheckoutMartClient";
import { SHOP_CARDS } from "../../../lib/data";

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

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("CheckoutMartClient", () => {
  it("renders an empty-bag state when no items", () => {
    renderWithBag(<CheckoutMartClient />);
    expect(screen.getByText(/empty|no items|your bag is empty/i)).toBeInTheDocument();
  });

  it("seeds a card from ?card= when bag is empty", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);
    expect(screen.getByText("Charizard")).toBeInTheDocument();
  });

  it("renders bag items with prices", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);
    // The item appears in a checkout-item container
    const item = document.querySelector('[data-checkout-item="true"]');
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain("8,500");
  });

  it("renders a total based on bag contents", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);
    const totalEl = document.querySelector("[data-checkout-total]");
    expect(totalEl?.textContent).toContain("8,500");
  });

  it("allows removing an item from the bag", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);

    const removeBtn = screen.getByRole("button", { name: /remove/i });
    await user.click(removeBtn);

    expect(screen.getByText(/empty|no items|your bag is empty/i)).toBeInTheDocument();
  });

  it("renders contact form fields", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);
    expect(screen.getByLabelText(/name|full name|contact name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email|e-mail/i)).toBeInTheDocument();
  });

  it("shows a Request Hold button", () => {
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);
    expect(
      screen.getByRole("button", { name: /request hold|submit|place hold/i }),
    ).toBeInTheDocument();
  });

  it("shows a confirmation after submitting Request Hold with valid contact info", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);

    await user.type(screen.getByLabelText(/name/i), "Ash Ketchum");
    await user.type(screen.getByLabelText(/email/i), "ash@example.com");
    await user.click(screen.getByRole("button", { name: /request hold/i }));

    expect(screen.getAllByText(/confirmed|received|submitted|success|thank you/i).length).toBeGreaterThan(0);
  });

  it("prevents submission when contact fields are empty", async () => {
    const user = userEvent.setup();
    renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);

    await user.click(screen.getByRole("button", { name: /request hold/i }));

    expect(screen.queryAllByText(/confirmed|received|submitted|success|thank you/i).length).toBe(0);
  });

  it("uses a 100vh / viewport-contained layout class", () => {
    const { container } = renderWithBag(<CheckoutMartClient initialCardId="charizard-base1" />);
    const main = container.querySelector("main");
    expect(main?.className).toMatch(/h-screen|min-h-screen|100vh|min-h-\[100svh\]/);
  });
});
