import { render, screen } from "@testing-library/react";
import ShopPage from "../page";

/**
 * /shop server-component routing tests.
 *
 * The page is a server component that branches on `searchParams.card` and
 * `searchParams.q` to show the details view directly instead of a grid list.
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
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

// Mock BagProvider so the client detail component can render in tests.
jest.mock("../../../components/bag/BagContext", () => {
  const React = require("react");
  const MockBagContext = React.createContext(null);
  const MockBagProvider = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const MockUseBag = () => ({
    items: [],
    cardIds: [],
    count: 0,
    total: 0,
    addCard: () => {},
    removeCard: () => {},
    clearBag: () => {},
    hasCard: () => false,
  });
  return {
    BagProvider: MockBagProvider,
    useBag: MockUseBag,
    BagContext: MockBagContext,
  };
});

describe("ShopPage", () => {
  it("renders a card-detail view when ?card=<id> matches", () => {
    render(<ShopPage searchParams={{ card: "charizard-base1" }} />);

    // The detail view always renders the price.
    expect(screen.getByText("8,500")).toBeInTheDocument();
    expect(screen.getByText("Add to Bag")).toBeInTheDocument();
  });

  it("falls back to the not-found state when ?card=<id> is bogus", () => {
    render(<ShopPage searchParams={{ card: "this-card-doesnt-exist" }} />);

    expect(screen.getByText("Card not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse all cards/i }),
    ).toHaveAttribute("href", "/shop");
  });

  it("renders the matched card details directly when ?q=<name> is provided", () => {
    render(<ShopPage searchParams={{ q: "Charizard" }} />);

    // Primary card title matches search query.
    expect(
      screen.getByRole("heading", { name: "Charizard", level: 1 }),
    ).toBeInTheDocument();
    // Blastoise is NOT the primary card shown (though it may appear in "Other Cards in Stock" carousel).
    expect(
      screen.queryByRole("heading", { name: "Blastoise", level: 1 }),
    ).toBeNull();
  });

  it("renders the default card when no params are provided", () => {
    render(<ShopPage searchParams={{}} />);

    // Default card is Charizard.
    expect(
      screen.getByRole("heading", { name: "Charizard", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders the no-results state when ?q matches nothing", () => {
    render(<ShopPage searchParams={{ q: "PikachuGen9Holo" }} />);

    expect(
      screen.getByRole("heading", { name: "No cards match" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse all cards/i }),
    ).toHaveAttribute("href", "/shop");
  });
});
