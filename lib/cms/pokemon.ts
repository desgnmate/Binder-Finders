import reference from "./pokemon.json";
import { POKEDEX_TILES, type ShopCard } from "../data";
export interface PokemonTile {
  id: number;
  name: string;
  types: string[];
  details: { generation: string };
}
// PokeAPI species/types CSV snapshot; see docs/cms.md for source and refresh guidance.
export function catalogPokemon(cards: ShopCard[]): PokemonTile[] {
  const ids = Array.from(
    new Set([
      ...POKEDEX_TILES.map((p) => p.id),
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
export function pokemonImage(id: number) {
  return POKEDEX_TILES.some((p) => p.id === id)
    ? `/sprites/gen3/${id}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}
