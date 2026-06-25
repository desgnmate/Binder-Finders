import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CardDetailClient } from "../CardDetailClient";
import { SHOP_CARDS, type ShopCard } from "../../../lib/data";

/**
 * CardDetailClient — redesigned card detail with add-to-bag.
 */

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/shop",
  useSearchParams: () => new URLSearchParams(),
}));

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

// Mock BagContext with a simple in-memory implementation.
jest.mock("../../bag/BagContext", () => {
  const React = require("react");
  const MockBagContext = React.createContext(null);

  const MockBagProvider = ({ children }: { children: React.ReactNode }) => {
    const [cardIds, setCardIds] = React.useState([] as string[]);
    const items = cardIds
      .map((id: string) => SHOP_CARDS.find((c) => c.id === id))
      .filter(Boolean);
    const value = {
      items,
      cardIds,
      count: items.length,
      total: items.reduce((s: number, c: any) => s + c.price, 0),
      addCard: (id: string) =>
        setCardIds((prev: string[]) =>
          prev.includes(id) ? prev : [...prev, id],
        ),
      removeCard: (id: string) =>
        setCardIds((prev: string[]) => prev.filter((x: string) => x !== id)),
      clearBag: () => setCardIds([]),
      hasCard: (id: string) => cardIds.includes(id),
    };
    return React.createElement(MockBagContext.Provider, { value }, children);
  };

  const useBag = () => {
    const ctx = React.useContext(MockBagContext);
    if (!ctx) throw new Error("useBag must be used within a BagProvider");
    return ctx;
  };

  return { BagProvider: MockBagProvider, useBag, BagContext: MockBagContext };
});

function renderWithBag(ui: React.ReactElement) {
  return render(<BagProvider>{ui}</BagProvider>);
}

// Import after mock setup
import { BagProvider } from "../../bag/BagContext";

describe("CardDetailClient", () => {
  it("renders the card name and price", () => {
    const card = SHOP_CARDS[0];
    const { container } = renderWithBag(<CardDetailClient card={card} />);
    expect(
      screen.getByRole("heading", { name: card.name, level: 1 }),
    ).toBeInTheDocument();
    const priceEl = container.querySelector("[data-card-price]");
    expect(priceEl?.textContent).toContain("8,500");
  });

  it("renders an Add to Bag button", () => {
    const card = SHOP_CARDS[0];
    renderWithBag(<CardDetailClient card={card} />);
    expect(
      screen.getByRole("button", { name: /Add to Bag/i }),
    ).toBeInTheDocument();
  });

  it("adds the card to the bag on click and shows confirmation", async () => {
    const user = userEvent.setup();
    const card = SHOP_CARDS[0];
    renderWithBag(<CardDetailClient card={card} />);

    const btn = screen.getByRole("button", { name: /Add to Bag/i });
    await user.click(btn);

    expect(screen.getByText(/added to bag/i)).toBeInTheDocument();
  });

  it("shows a checkout CTA after adding to bag", async () => {
    const user = userEvent.setup();
    const card = SHOP_CARDS[0];
    const { container } = renderWithBag(<CardDetailClient card={card} />);

    await user.click(screen.getByRole("button", { name: /Add to Bag/i }));

    const cta = container.querySelector('[data-card-cta="true"][href="/checkout"]');
    expect(cta).not.toBeNull();
  });

  it("replaces Add to Bag button with confirmation after adding", async () => {
    const user = userEvent.setup();
    const card = SHOP_CARDS[0];
    renderWithBag(<CardDetailClient card={card} />);

    await user.click(screen.getByRole("button", { name: /Add to Bag/i }));
    expect(screen.getByText(/added to bag/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add to Bag$/i })).toBeNull();
  });

  it("flips the card to the back face when the 3D wrapper is clicked", async () => {
    const user = userEvent.setup();
    const card = SHOP_CARDS[0];
    const { container } = renderWithBag(<CardDetailClient card={card} />);

    const inner = container.querySelector("[data-magnetic-card-inner]") as HTMLElement;
    expect(inner).not.toBeNull();
    expect(inner.style.transform).toContain("rotateY(0.00deg)");

    const wrapper = container.querySelector(".magnetic-card-wrapper") as HTMLElement;
    expect(wrapper).not.toBeNull();
    
    // Click to flip
    await user.click(wrapper);
    expect(inner.style.transform).toContain("rotateY(180.00deg)");

    // Click again to flip back
    await user.click(wrapper);
    expect(inner.style.transform).toContain("rotateY(0.00deg)");
  });

  describe("Search & Filters", () => {
    beforeEach(() => {
      mockPush.mockClear();
    });

    it("renders search input and filter dropdowns", () => {
      renderWithBag(<CardDetailClient card={SHOP_CARDS[0]} />);

      expect(
        screen.getByPlaceholderText(/Search cards by name, set, type/i),
      ).toBeInTheDocument();
      expect(screen.getByText("All Types")).toBeInTheDocument();
      expect(screen.getByText("All Sets")).toBeInTheDocument();
    });

    it("navigates on type dropdown change", async () => {
      const user = userEvent.setup();
      const { container } = renderWithBag(<CardDetailClient card={SHOP_CARDS[0]} />);

      // Find first select element (Type select)
      const selects = container.querySelectorAll("select");
      expect(selects.length).toBeGreaterThanOrEqual(1);

      await user.selectOptions(selects[0], "fire");
      expect(mockPush).toHaveBeenCalledWith("/shop?type=fire");
    });
  });
});
