import { render } from "@testing-library/react";
import { PokedexPageClient } from "../PokedexPageClient";

describe("PokedexPageClient", () => {
  it("renders the dedicated Pokémon grid inside a Game Boy screen effect", () => {
    const { container } = render(<PokedexPageClient />);
    const screen = container.querySelector("[data-pokedex-screen-overlay='true']");
    expect(screen).not.toBeNull();
    expect(screen?.className).toMatch(/\bgameboy-screen\b/);
  });
});
