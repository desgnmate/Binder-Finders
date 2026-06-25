import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PokedexSection } from "../PokedexSection";
import { POKEDEX_TILES } from "../../../lib/data";

/**
 * PokedexSection — homepage Pokédex device preview.
 *
 * The homepage Pokédex mirrors the dedicated /pokedex page: a red Pokédex
 * device body with a cream info panel, a search bar, a blue detail screen
 * on the left, and a dark screen with a green grid of Pokémon tiles on
 * the right. The homepage version caps the visible tiles to keep the
 * section compact.
 */

describe("PokedexSection", () => {
  it("renders the 'Pokédex' heading", () => {
    render(<PokedexSection />);
    expect(
      screen.getByRole("heading", { name: /Pokédex/i }),
    ).toBeInTheDocument();
  });

  it("renders the search subtitle", () => {
    render(<PokedexSection />);
    expect(
      screen.getByText(/Search for a Pokémon by name or using its National Pokédex number/i),
    ).toBeInTheDocument();
  });

  it("carries the data-pokedex-section marker", () => {
    const { container } = render(<PokedexSection />);
    expect(
      container.querySelector("[data-pokedex-section]"),
    ).not.toBeNull();
  });


  it("renders the homepage Pokémon grid inside a Game Boy screen effect", () => {
    const { container } = render(<PokedexSection />);
    const screen = container.querySelector("[data-pokedex-screen-overlay='true']");
    expect(screen).not.toBeNull();
    expect(screen?.className).toMatch(/\bgameboy-screen\b/);
  });

  it("renders a search input with the expected placeholder", () => {
    render(<PokedexSection />);
    const input = screen.getByPlaceholderText(/Name or number/i);
    expect(input).toBeInTheDocument();
  });

  it("renders a capped preview, not all POKEDEX_TILES", () => {
    render(<PokedexSection />);
    const tiles = screen.getAllByTestId("pokedex-tile");
    expect(tiles.length).toBeLessThan(POKEDEX_TILES.length);
    expect(tiles.length).toBeGreaterThan(0);
  });

  it("renders a 'View full Pokédex' CTA linking to /pokedex", () => {
    render(<PokedexSection />);
    const cta = screen.getByRole("link", { name: /View full Pokédex/i });
    expect(cta.getAttribute("href")).toBe("/pokedex");
  });

  it("each visible tile shows the dex number", () => {
    render(<PokedexSection />);
    const tiles = screen.getAllByTestId("pokedex-tile");
    for (const tile of tiles) {
      const num = tile.querySelector("[data-pokedex-tile-number]");
      expect(num).not.toBeNull();
    }
  });

  it("each visible tile shows the Pokémon name", () => {
    render(<PokedexSection />);
    const tiles = screen.getAllByTestId("pokedex-tile");
    expect(tiles.length).toBeGreaterThan(0);
    const firstName = tiles[0].querySelector("[data-pokedex-tile-name]");
    expect(firstName?.textContent).toBeTruthy();
  });

  it("every sprite has the .pokedex-sprite class", () => {
    const { container } = render(<PokedexSection />);
    const tiles = container.querySelectorAll("[data-pokedex-tile]");
    for (const tile of Array.from(tiles)) {
      const sprite = tile.querySelector("img");
      expect(sprite).not.toBeNull();
      expect(sprite!.classList.contains("pokedex-sprite")).toBe(true);
    }
  });

  it("filters the grid by name (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<PokedexSection />);

    const input = screen.getByPlaceholderText(/Name or number/i);
    await user.type(input, "izard");

    const tiles = screen.getAllByTestId("pokedex-tile");
    expect(tiles.length).toBe(1);
  });

  it("filters the grid by dex number (no '#', no leading zeros)", async () => {
    const user = userEvent.setup();
    render(<PokedexSection />);

    const input = screen.getByPlaceholderText(/Name or number/i);
    await user.type(input, "150");

    const tiles = screen.getAllByTestId("pokedex-tile");
    expect(tiles.length).toBe(1);
  });

  it("shows the empty state when no Pokémon match", async () => {
    const user = userEvent.setup();
    render(<PokedexSection />);

    const input = screen.getByPlaceholderText(/Name or number/i);
    await user.type(input, "zzzz");

    expect(screen.getByTestId("pokedex-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/No Pokémon match/i),
    ).toBeInTheDocument();
  });

  it("tiles do NOT link to /shop?q= (results page removed)", () => {
    render(<PokedexSection />);
    const tiles = screen.getAllByTestId("pokedex-tile");
    for (const tile of tiles) {
      const href = tile.getAttribute("href") ?? "";
      expect(href).not.toContain("/shop?q=");
    }
  });
});
