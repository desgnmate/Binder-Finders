import { DEFAULT_POKEDEX_IDS, catalogPokemon, pokemonImage, pokemonName, spritePokemon } from "../pokemon";
import type { ShopCard } from "../../data";

const card = (pokemonId: number) => ({ pokemonId }) as ShopCard;

describe("Pokédex list", () => {
  it("offers every Gen I–IV Pokémon to choose from", () => {
    const all = spritePokemon();
    expect(all).toHaveLength(493);
    expect(all[0]).toMatchObject({ id: 1, name: "Bulbasaur" });
    expect(all[385]).toMatchObject({ id: 386, name: "Deoxys" });
    expect(all[492]).toMatchObject({ id: 493, name: "Arceus" });
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

  it("uses Emerald sprites to #386, Platinum sprites to #493, then PokeAPI", () => {
    expect(pokemonImage(386)).toBe("/sprites/gen3/386.png");
    expect(pokemonImage(387)).toBe("/sprites/gen4/387.png");
    expect(pokemonImage(493)).toBe("/sprites/gen4/493.png");
    expect(pokemonImage(494)).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
  });
});
