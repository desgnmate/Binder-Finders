import { fireEvent, render, screen } from "@testing-library/react";
import { PokedexPageClient } from "../PokedexPageClient";

describe("PokedexPageClient", () => {
  it("uses the simplified summary and available counts while retaining shop links", () => {
    const { container } = render(<PokedexPageClient />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Charizard" } });
    expect(screen.getByText("2 cards available")).toBeInTheDocument();
    expect(screen.getByText("Gen I")).toBeInTheDocument();
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
});
