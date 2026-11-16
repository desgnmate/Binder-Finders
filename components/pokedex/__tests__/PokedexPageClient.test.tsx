import { fireEvent, render, screen } from "@testing-library/react";
import { PokedexPageClient, pageList } from "../PokedexPageClient";

describe("PokedexPageClient", () => {
  it("uses the simplified summary and available counts while retaining shop links", () => {
    const { container } = render(<PokedexPageClient />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Charizard" } });
    expect(screen.getByText("2 cards available")).toBeInTheDocument();
    expect(container.querySelector("[data-pokedex-preview-panel]")).toHaveTextContent("Gen I");
    expect(screen.queryByText("Base Stats")).not.toBeInTheDocument();
    expect(screen.queryByText("HT")).not.toBeInTheDocument();
    expect(screen.queryByText(/8,500/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View cards in stock" })).toHaveAttribute("href", "/shop?pokemon=6");
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "no-match" } });
    expect(container.querySelector("[data-pokedex-preview-panel]")).toBeNull();
    expect(screen.getByText(/No Pokémon match/)).toBeInTheDocument();
  });
  it("renders the dedicated Pokémon grid inside a Game Boy screen effect", () => {
    const { container } = render(<PokedexPageClient />);
    const screen = container.querySelector("[data-pokedex-screen-overlay='true']");
    expect(screen).not.toBeNull();
    expect(screen?.className).toMatch(/\bgameboy-screen\b/);
  });

  it("shows 15 Pokémon per page with page controls", () => {
    const { container } = render(<PokedexPageClient />);
    const tiles = () => container.querySelectorAll("[data-pokedex-screen-overlay] .grid > a");
    const total = Number(screen.getByText(/^1–15 of \d+$/).textContent!.split(" of ")[1]);
    expect(tiles()).toHaveLength(15);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(tiles().length).toBe(Math.min(15, total - 15));
    expect(screen.getByRole("button", { name: /Prev/ })).toBeEnabled();
  });

  it("filters by generation and starts again at page one", () => {
    const { container } = render(<PokedexPageClient />);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gen II" }));
    expect(screen.getByRole("button", { name: "Gen II" })).toHaveAttribute("aria-pressed", "true");
    const ids = [...container.querySelectorAll("[data-pokedex-screen-overlay] .grid > a")].map((a) => Number(a.getAttribute("href")!.split("=")[1]));
    expect(ids.length).toBeGreaterThan(0);
    // Gen II is #152–251.
    expect(ids.every((id) => id >= 152 && id <= 251)).toBe(true);
    expect(screen.queryByRole("button", { name: "Page 2" })?.getAttribute("aria-current") ?? null).toBeNull();
  });

  it("keeps the page buttons short when there are many pages", () => {
    expect(pageList(0, 33)).toEqual([0, 1, null, 32]);
    expect(pageList(10, 33)).toEqual([0, null, 9, 10, 11, null, 32]);
    expect(pageList(2, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(pageList(0, 1)).toEqual([0]);
  });
});
