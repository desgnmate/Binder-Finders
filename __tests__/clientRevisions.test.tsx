import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BagProvider, useBag } from "../components/bag/BagContext";
import { QuickAdd } from "../components/shop/QuickAdd";
import { CardDetailClient } from "../components/shop/CardDetailClient";
import { PokedexSection } from "../components/pokedex/PokedexSection";
import { BinderSection } from "../components/binder/BinderSection";
import { CheckoutMartClient } from "../components/checkout/CheckoutMartClient";
import { SHOP_CARDS, availableCardCount } from "../lib/data";

const mockReplace = jest.fn();
let mockParams = "";
jest.mock("next/navigation", () => ({
  usePathname: () => "/shop",
  useSearchParams: () => new URLSearchParams(mockParams),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

beforeEach(() => { localStorage.clear(); mockParams = ""; mockReplace.mockClear(); });

it("counts available listings by Pokémon identity, including variants and zero stock", () => {
  expect(availableCardCount(6)).toBe(2);
  expect(availableCardCount(1)).toBe(0);
  expect(availableCardCount(6, [{ ...SHOP_CARDS[0], availability: "sold" }])).toBe(0);
  expect(availableCardCount(6, [{ ...SHOP_CARDS[0], availability: "unavailable" }])).toBe(0);
});

it("shows a simplified Pokémon preview and catalog count without prices or stats", async () => {
  const user = userEvent.setup();
  render(<PokedexSection />);
  await user.type(screen.getByPlaceholderText("Name or number"), "Charizard");
  expect(screen.getByText("2 cards available")).toBeInTheDocument();
  expect(screen.getByText("Gen I")).toBeInTheDocument();
  expect(screen.queryByText("Base Stats")).not.toBeInTheDocument();
  expect(screen.queryByText("8,500")).not.toBeInTheDocument();
  await user.clear(screen.getByPlaceholderText("Name or number"));
  await user.type(screen.getByPlaceholderText("Name or number"), "no-such-pokemon");
  expect(screen.queryByText("Gen I")).not.toBeInTheDocument();
});

it("quick-adds once and preserves the existing saved-bag format across remounts", async () => {
  const user = userEvent.setup();
  const view = render(<BagProvider><QuickAdd card={SHOP_CARDS[0]} /></BagProvider>);
  await user.click(screen.getByRole("button", { name: "Add Charizard to bag" }));
  expect(screen.getByRole("button", { name: "Charizard is in your bag" })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem("binderfinders:bag:v1")!)).toEqual(["charizard-base1"]);
  view.unmount();
  render(<BagProvider><QuickAdd card={SHOP_CARDS[0]} /></BagProvider>);
  expect(screen.getByRole("button", { name: "Charizard is in your bag" })).toBeDisabled();
});

it("does not offer quick add for unavailable cards", () => {
  render(<BagProvider><QuickAdd card={{ ...SHOP_CARDS[0], availability: "sold" }} /></BagProvider>);
  expect(screen.getByRole("button")).toBeDisabled();
  expect(localStorage.getItem("binderfinders:bag:v1")).toBe("[]");
});

it("ignores invalid IDs without corrupting the bag", async () => {
  function InvalidAdd() { const bag = useBag(); return <button onClick={() => bag.addCard("invalid")}>Add invalid</button>; }
  render(<BagProvider><InvalidAdd /></BagProvider>);
  await userEvent.setup().click(screen.getByText("Add invalid"));
  expect(localStorage.getItem("binderfinders:bag:v1")).toBe("[]");
});

it("preserves search parameters in inspection links and when closing a direct listing", () => {
  mockParams = "q=Charizard&type=fire&card=charizard-base1";
  render(<BagProvider><CardDetailClient card={SHOP_CARDS[0]} filteredCards={[SHOP_CARDS[0]]} /></BagProvider>);
  expect(screen.getByRole("link", { name: /^Inspect Charizard/ })).toHaveAttribute("href", "/shop?q=Charizard&type=fire&card=charizard-base1");
  fireEvent.click(screen.getByRole("button", { name: "Close inspection" }));
  expect(mockReplace).toHaveBeenCalledWith("/shop?q=Charizard&type=fire", { scroll: false });
});

it("retains card specifications and supports stable enlargement with an honest reference back", async () => {
  const user = userEvent.setup();
  render(<BagProvider><CardDetailClient card={SHOP_CARDS[0]} /></BagProvider>);
  const dialog = within(screen.getByRole("dialog", { name: "Inspect Charizard" }));
  expect(dialog.getByText("4/102")).toBeInTheDocument();
  expect(dialog.getByText("PSA 9")).toBeInTheDocument();
  expect(dialog.queryByText(SHOP_CARDS[0].description)).not.toBeInTheDocument();
  await user.click(dialog.getByRole("button", { name: "Enlarge image" }));
  expect(dialog.getByRole("img", { name: "Charizard front enlarged" })).toBeInTheDocument();
  await user.click(dialog.getByRole("button", { name: "Show reference back" }));
  expect(dialog.getByText(/not a scan of this individual card/)).toBeInTheDocument();
});

it("routes Escape through the close action so the URL and dialog cannot diverge", () => {
  mockParams = "q=Charizard&card=charizard-base1";
  const view = render(<BagProvider><CardDetailClient card={SHOP_CARDS[0]} /></BagProvider>);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Inspect Charizard" }), { key: "Escape" });
  expect(mockReplace).toHaveBeenCalledWith("/shop?q=Charizard", { scroll: false });
  view.unmount();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("keeps the Binder era and search filters when changing density", async () => {
  const user = userEvent.setup();
  const { container } = render(<BagProvider><BinderSection /></BagProvider>);
  await user.click(screen.getByRole("tab", { name: "Team Rocket · 2000" }));
  await user.type(screen.getByLabelText("Search binder cards"), "Charizard");
  // CSS hides these controls on small screens; jsdom does not evaluate media queries.
  fireEvent.click(screen.getByRole("button", { name: "8" }));
  expect(container.querySelector("[data-binder-grid]")).toHaveAttribute("data-columns", "8");
  expect(container.querySelectorAll("[data-binder-card]")).toHaveLength(1);
  expect(screen.getByRole("tab", { name: "Team Rocket · 2000" })).toHaveAttribute("aria-selected", "true");
  await user.click(screen.getByRole("button", { name: "Add Dark Charizard to bag" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows cart images and respects a saved bag over a checkout card parameter", () => {
  localStorage.setItem("binderfinders:bag:v1", JSON.stringify(["blastoise-base1"]));
  render(<BagProvider><CheckoutMartClient initialCardId="charizard-base1" customer={{ email: "ash@example.com", name: "Ash Ketchum" }} /></BagProvider>);
  expect(screen.getByRole("img", { name: "Blastoise card" })).toHaveAttribute("src", SHOP_CARDS[1].imageUrl);
  expect(screen.queryByRole("img", { name: "Charizard card" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Inspect Blastoise" })).toHaveAttribute("href", "/shop?card=blastoise-base1");
});
