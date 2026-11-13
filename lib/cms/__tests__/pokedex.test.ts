import { DEFAULT_POKEDEX_IDS, catalogPokemon, gen3Pokemon, pokemonName } from "../pokemon";
import type { ShopCard } from "../../data";

const card = (pokemonId: number) => ({ pokemonId }) as ShopCard;

describe("Pokédex list", () => {
  it("offers every Gen III Pokémon to choose from", () => {
    const all = gen3Pokemon();
    expect(all).toHaveLength(386);
    expect(all[0]).toMatchObject({ id: 1, name: "Bulbasaur" });
    expect(all[385]).toMatchObject({ id: 386, name: "Deoxys" });
  });

  it("uses the built-in list until the store chooses its own", () => {
    expect(catalogPokemon([]).map((p) => p.id)).toEqual([...DEFAULT_POKEDEX_IDS].sort((a, b) => a - b));
  });

  it("shows the store's chosen Pokémon plus any with a listed card", () => {
    const ids = catalogPokemon([card(150)], [300, 25]).map((p) => p.id);
    expect(ids).toEqual([25, 150, 300]);
    expect(catalogPokemon([], [300])[0]).toMatchObject({ name: "Skitty", details: { generation: "Gen III" } });
  });

  it("never ends up empty", () => {
    expect(catalogPokemon([], []).length).toBe(DEFAULT_POKEDEX_IDS.length);
  });

  it("names Pokémon by number", () => {
    expect(pokemonName(6)).toBe("Charizard");
    expect(pokemonName(9999)).toBe("");
  });
});
