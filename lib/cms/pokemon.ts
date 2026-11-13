import reference from "./pokemon.json";
import { POKEDEX_TILES, type ShopCard } from "../data";
export interface PokemonTile {
  id: number;
  name: string;
  types: string[];
  details: { generation: string };
}
/** The Pokémon the Pokédex shows when the store hasn't chosen its own list. */
export const DEFAULT_POKEDEX_IDS = POKEDEX_TILES.map((p) => p.id);

/** Every Pokémon with a Gen III sprite, for the admin picker. */
export function gen3Pokemon() {
  return reference
    .filter((p) => p.id >= 1 && p.id <= GEN3_LAST_ID)
    .map((p) => ({ id: p.id, name: p.name, types: p.types }));
}

// PokeAPI species/types CSV snapshot; see docs/cms.md for source and refresh guidance.
// The Pokédex shows the store's chosen Pokémon plus any Pokémon with a listed card.
export function catalogPokemon(cards: ShopCard[], chosen: number[] = DEFAULT_POKEDEX_IDS): PokemonTile[] {
  const ids = Array.from(
    new Set([
      // An empty choice would leave the Pokédex blank, so fall back to the defaults.
      ...(chosen.length ? chosen : DEFAULT_POKEDEX_IDS),
      ...cards.map((c) => c.pokemonId),
    ]),
  );
  return ids
    .sort((a, b) => a - b)
    .flatMap((id) => {
      const existing = POKEDEX_TILES.find((p) => p.id === id);
      if (existing) return [existing];
      const species = reference.find((p) => p.id === id);
      if (!species) return [];
      return [
        {
          id,
          name: species.name,
          types: species.types,
          details: {
            generation: `Gen ${["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][species.generation]}`,
          },
        },
      ];
    });
}
// Gen III games cover National Pokédex #1–386; public/sprites/gen3 holds an
// Emerald sprite for each. Later Pokémon have no Gen III sprite.
const GEN3_LAST_ID = 386;
export function pokemonImage(id: number) {
  return Number.isInteger(id) && id >= 1 && id <= GEN3_LAST_ID
    ? `/sprites/gen3/${id}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

/** The Pokémon's English name, or "" for an unknown number. */
export function pokemonName(id: number) {
  return reference.find((p) => p.id === id)?.name ?? "";
}
