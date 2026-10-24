import { render, screen, within } from "@testing-library/react";
import ShopPage from "../page";
jest.mock("../../../../lib/cms/catalog",()=>({getCatalog:async()=>({cards:require("../../../../lib/data").SHOP_CARDS})}));

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
    scroll: _scroll,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    scroll?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// Mock BagProvider so the client detail component can render in tests.
jest.mock("../../../../components/bag/BagContext", () => {
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
  it("renders a card-detail view when ?card=<id> matches", async () => {
    render(await ShopPage({searchParams:Promise.resolve({ card: "charizard-base1" })}));

    // The detail view always renders the price.
    const dialog = within(screen.getByRole("dialog", { name: "Inspect Charizard" }));
    expect(dialog.getByText("8,500")).toBeInTheDocument();
    expect(dialog.getByText("Add to Bag")).toBeInTheDocument();
  });

  it("falls back to the not-found state when ?card=<id> is bogus", async () => {
    render(await ShopPage({searchParams:Promise.resolve({ card: "this-card-doesnt-exist" })}));

    expect(screen.getByText("Card not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse all cards/i }),
    ).toHaveAttribute("href", "/shop");
  });

  it("shows matching listings without automatically opening inspection", async () => {
    render(await ShopPage({searchParams:Promise.resolve({ q: "Charizard" })}));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inspect Charizard/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inspect Dark Charizard/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Inspect Blastoise/ })).not.toBeInTheDocument();
  });

  it("opens the catalog without a default inspection when no params are provided", async () => {
    render(await ShopPage({searchParams:Promise.resolve({})}));

    expect(screen.getByRole("heading", { name: "Shop the Binder", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inspect Charizard/ })).toHaveAttribute("href", "/shop?card=charizard-base1");
  });

  it("renders the no-results state when ?q matches nothing", async () => {
    render(await ShopPage({searchParams:Promise.resolve({ q: "PikachuGen9Holo" })}));

    expect(
      screen.getByRole("heading", { name: "No cards match" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse all cards/i }),
    ).toHaveAttribute("href", "/shop");
  });
});
