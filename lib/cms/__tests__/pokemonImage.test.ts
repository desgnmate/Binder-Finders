import { existsSync } from "node:fs";
import path from "node:path";
import { pokemonImage } from "../pokemon";

describe("pokemonImage", () => {
  it("serves a local Gen III sprite for every Pokémon in the Gen III games", () => {
    for (let id = 1; id <= 386; id += 1) {
      expect(pokemonImage(id)).toBe(`/sprites/gen3/${id}.png`);
      expect(existsSync(path.join(process.cwd(), "public", "sprites", "gen3", `${id}.png`))).toBe(true);
    }
  });

  it("falls back to PokeAPI for Pokémon introduced after Gen III", () => {
    expect(pokemonImage(387)).toBe("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/387.png");
    expect(pokemonImage(0)).toContain("raw.githubusercontent.com");
  });
});
