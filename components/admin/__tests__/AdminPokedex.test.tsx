import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPokedex } from "../AdminPokedex";
import { defaultSettings } from "../../../lib/cms/types";
import { DEFAULT_POKEDEX_IDS } from "../../../lib/cms/pokemon";

jest.mock("../../../app/admin/actions", () => ({}));

function setup(cardPokemonIds: number[] = []) {
  const onChange = jest.fn();
  render(
    <AdminPokedex
      draft={defaultSettings}
      dirty={false}
      busy={false}
      cardPokemonIds={cardPokemonIds}
      onChange={onChange}
      onDiscard={jest.fn()}
      onSave={jest.fn()}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe("Admin Pokédex picker", () => {
  it("lists all 386 Gen III Pokémon", () => {
    setup();
    expect(document.querySelectorAll(".cms-pokedex-tile")).toHaveLength(386);
  });

  it("adds a Pokémon to the Pokédex", async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByRole("searchbox", { name: /search pokémon/i }), "Skitty");
    await user.click(screen.getByRole("button", { name: /skitty/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pokedexIds: [...DEFAULT_POKEDEX_IDS, 300].sort((a, b) => a - b) }));
  });

  it("can show every Pokémon at once", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: /show all 386/i }));
    expect(onChange.mock.calls[0][0].pokedexIds).toHaveLength(386);
  });

  it("always shows Pokémon that have a listed card", () => {
    setup([300]);
    const skitty = screen.getByRole("button", { name: /skitty/i });
    expect(skitty).toBeDisabled();
    expect(skitty).toHaveAttribute("aria-pressed", "true");
  });
});
