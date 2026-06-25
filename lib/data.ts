/**
 * BinderFinders unified data — Pokédex grid tiles + binder pages + hero fan.
 *
 * Gen 3 (Emerald) sprites are served locally from `public/sprites/gen3/`
 * (sourced from the "Gen 3 Sprite Pack V1.0" asset drop — see the
 * project root for the original files).
 *
 * TCG card images are pulled from the Pokemon TCG API CDN
 * (https://pokemontcg.io/) — these are high-res scans of real Gen 1 era
 * cards (Base Set, Team Rocket, Neo Revelation). The CDN URL pattern is
 * deterministic: `https://images.pokemontcg.io/<setId>/<number>_hires.png`.
 *
 * Local sprite path:   /sprites/gen3/<id>.png
 * TCG card path:      https://images.pokemontcg.io/<setId>/<number>_hires.png
 *
 * Colours normalized to the project's brand tokens:
 *   brand-yellow  #fedd25   brand-blue   #3194ee   brand-pink   #ffd6e0
 *   ink-black     #1a1a1a   cream        #fff6e0
 */

// ---------------------------------------------------------------------------
// Sprite / artwork helpers
// ---------------------------------------------------------------------------

/** Local path for Gen-III (Emerald) front sprites. */
export const GEN3_SPRITE_BASE = "/sprites/gen3";

/** Base URL for the Pokemon TCG API image CDN. */
export const TCG_IMAGE_BASE = "https://images.pokemontcg.io";

/** Full-res official artwork (used for the hero fan — Pokémon portraits, not cards). */
export const ARTWORK_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

/** Build a local Gen-3 sprite URL for a given Pokédex id. */
export function gen3Sprite(id: number): string {
  return `${GEN3_SPRITE_BASE}/${id}.png`;
}

/** Build a high-res TCG card image URL for a given set + card number. */
export function tcgCardImage(setId: string, number: string): string {
  return `${TCG_IMAGE_BASE}/${setId}/${number}_hires.png`;
}

/** Build an official-artwork URL for a given Pokédex id. */
export function artwork(id: number): string {
  return `${ARTWORK_BASE}/${id}.png`;
}

// ---------------------------------------------------------------------------
// Shared card model (graded / raw listings)
// ---------------------------------------------------------------------------

export type CardType =
  | "Fire"
  | "Water"
  | "Grass"
  | "Lightning"
  | "Psychic"
  | "Metal"
  | "Colorless"
  | "Dark"
  | "Dragon"
  | "Fighting"
  | "Ground"
  | "Flying"
  | "Ice"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Poison"
  | "Normal"
  | "Steel"
  | "Fairy";

export type CardRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Rare Holo"
  | "Ultra Rare"
  | "Secret Rare"
  | "Shining Holo";

export type CardCondition =
  | "RAW NM"
  | "RAW LP"
  | "PSA 8"
  | "PSA 9"
  | "PSA 10";

export interface ShopCard {
  id: string;
  name: string;
  pokemonId: number;
  set: string;
  year: number;
  number: string;
  rarity: CardRarity;
  condition: CardCondition;
  price: number; // numeric units; the brief doesn't pin a currency symbol
  type: CardType;
  imageUrl: string;
  description: string;
  views: number;
}

/**
 * Format a price with thousands separators.
 *
 * The brief doesn't pin a currency symbol (the shop is local — GenSan /
 * Mindanao), so the default returns just the formatted number: `4500`
 * → `"4,500"`. Pass a currency string explicitly if you ever need one
 * (e.g. `formatPrice(4500, "PHP ")` → `"PHP 4,500"`, or pass `"$"` for
 * USD-style formatting).
 */
export function formatPrice(price: number, currency = ""): string {
  return `${currency}${price.toLocaleString("en-US")}`;
}

/** Short condition tag for the price-dot overlay (e.g. "PSA 9" → "PSA9"). */
export function shortCondition(condition: CardCondition): string {
  return condition.replace(/\s+/g, "");
}

// ---------------------------------------------------------------------------
// Shop cards (graded / raw) — also seed the binder pages + hero fan.
//
// All entries are Gen 1 TCG cards from the WOTC era (1999-2002):
//   - Base Set (base1): the iconic holos + a few commons
//   - Team Rocket (base5): the Dark Pokémon subset
//   - Neo Revelation (neo3): Shining rares
// Card images are pulled from the Pokemon TCG API CDN.
// ---------------------------------------------------------------------------

export const SHOP_CARDS: ShopCard[] = [
  // --- Base Set holo rares ---
  {
    id: "charizard-base1",
    name: "Charizard",
    pokemonId: 6,
    set: "Base Set",
    year: 1999,
    number: "4/102",
    rarity: "Rare Holo",
    condition: "PSA 9",
    price: 8500,
    type: "Fire",
    imageUrl: tcgCardImage("base1", "4"),
    description:
      "The undisputed king of Gen 1 TCG. Base Set Charizard holo in PSA 9 — sharp corners, clean surface, iconic centering.",
    views: 1284,
  },
  {
    id: "blastoise-base1",
    name: "Blastoise",
    pokemonId: 9,
    set: "Base Set",
    year: 1999,
    number: "2/102",
    rarity: "Rare Holo",
    condition: "PSA 8",
    price: 2200,
    type: "Water",
    imageUrl: tcgCardImage("base1", "2"),
    description:
      "The original Base Set Blastoise holo. PSA 8 with strong eye appeal and no surface scratching.",
    views: 743,
  },
  {
    id: "venusaur-base1",
    name: "Venusaur",
    pokemonId: 3,
    set: "Base Set",
    year: 1999,
    number: "15/102",
    rarity: "Rare Holo",
    condition: "PSA 8",
    price: 1600,
    type: "Grass",
    imageUrl: tcgCardImage("base1", "15"),
    description:
      "Base Set Venusaur holo. PSA 8 with vivid green holo foil and crisp borders.",
    views: 521,
  },
  {
    id: "mewtwo-base1",
    name: "Mewtwo",
    pokemonId: 150,
    set: "Base Set",
    year: 1999,
    number: "10/102",
    rarity: "Rare Holo",
    condition: "PSA 10",
    price: 3400,
    type: "Psychic",
    imageUrl: tcgCardImage("base1", "10"),
    description:
      "Base Set Mewtwo holo in Gem Mint PSA 10. The genetic Pokémon at its most pristine — a true centrepiece card.",
    views: 892,
  },
  // --- Base Set supporting cards ---
  {
    id: "pikachu-base1",
    name: "Pikachu",
    pokemonId: 25,
    set: "Base Set",
    year: 1999,
    number: "58/102",
    rarity: "Common",
    condition: "RAW NM",
    price: 45,
    type: "Lightning",
    imageUrl: tcgCardImage("base1", "58"),
    description:
      "The original Base Set Pikachu. Raw near-mint with the iconic 'have you seen it?' attack.",
    views: 612,
  },
  {
    id: "raichu-base1",
    name: "Raichu",
    pokemonId: 26,
    set: "Base Set",
    year: 1999,
    number: "14/102",
    rarity: "Rare Holo",
    condition: "RAW NM",
    price: 220,
    type: "Lightning",
    imageUrl: tcgCardImage("base1", "14"),
    description:
      "Base Set Raichu holo. Raw near-mint with full holo shine and clean borders.",
    views: 198,
  },
  {
    id: "psyduck-fossil",
    name: "Psyduck",
    pokemonId: 54,
    set: "Fossil",
    year: 1999,
    number: "53/62",
    rarity: "Common",
    condition: "RAW NM",
    price: 35,
    type: "Water",
    imageUrl: tcgCardImage("base3", "53"),
    description:
      "Fossil Psyduck raw near-mint. A goofy binder favorite with clean scan-friendly artwork and strong nostalgia value.",
    views: 154,
  },
  {
    id: "koffing-base1",
    name: "Koffing",
    pokemonId: 109,
    set: "Base Set",
    year: 1999,
    number: "51/102",
    rarity: "Common",
    condition: "RAW LP",
    price: 28,
    type: "Poison",
    imageUrl: tcgCardImage("base1", "51"),
    description:
      "Base Set Koffing raw light-play. A classic oddball binder card with strong retro sprite energy.",
    views: 118,
  },
  {
    id: "wooper-neo",
    name: "Wooper",
    pokemonId: 194,
    set: "Neo Genesis",
    year: 2000,
    number: "82/111",
    rarity: "Common",
    condition: "RAW NM",
    price: 30,
    type: "Water",
    imageUrl: tcgCardImage("neo1", "82"),
    description:
      "Neo Genesis Wooper raw near-mint. Friendly, simple, and perfect for the cute Gen 2 side of the binder.",
    views: 96,
  },
  {
    id: "wobbuffet-neo",
    name: "Wobbuffet",
    pokemonId: 202,
    set: "Neo Discovery",
    year: 2001,
    number: "16/75",
    rarity: "Rare Holo",
    condition: "RAW NM",
    price: 380,
    type: "Psychic",
    imageUrl: tcgCardImage("neo2", "16"),
    description:
      "Neo Discovery Wobbuffet holo raw near-mint. A perfect mascot card for the contact and support area.",
    views: 141,
  },
  {
    id: "gyarados-base1",
    name: "Gyarados",
    pokemonId: 130,
    set: "Base Set",
    year: 1999,
    number: "8/102",
    rarity: "Rare Holo",
    condition: "PSA 9",
    price: 1450,
    type: "Water",
    imageUrl: tcgCardImage("base1", "8"),
    description:
      "Base Set Gyarados holo. PSA 9 with the signature angry-water-snake energy at full volume.",
    views: 467,
  },
  // --- Team Rocket (Dark Pokémon subset) ---
  {
    id: "dark-charizard-rocket",
    name: "Dark Charizard",
    pokemonId: 6,
    set: "Team Rocket",
    year: 2000,
    number: "4/82",
    rarity: "Rare Holo",
    condition: "PSA 9",
    price: 3200,
    type: "Fire",
    imageUrl: tcgCardImage("base5", "4"),
    description:
      "Team Rocket's Dark Charizard holo. PSA 9 with the dark-type treatment — menacing, foil-rich, iconic.",
    views: 654,
  },
  {
    id: "dark-blastoise-rocket",
    name: "Dark Blastoise",
    pokemonId: 9,
    set: "Team Rocket",
    year: 2000,
    number: "2/82",
    rarity: "Rare Holo",
    condition: "PSA 8",
    price: 1450,
    type: "Water",
    imageUrl: tcgCardImage("base5", "2"),
    description:
      "Team Rocket's Dark Blastoise holo. PSA 8 with the corrupted-cannon-turtle treatment.",
    views: 312,
  },
  {
    id: "rockets-scyther-rocket",
    name: "Rocket's Scyther",
    pokemonId: 123,
    set: "Team Rocket",
    year: 2000,
    number: "10/82",
    rarity: "Rare Holo",
    condition: "RAW LP",
    price: 280,
    type: "Grass",
    imageUrl: tcgCardImage("base5", "10"),
    description:
      "Rocket's Scyther holo. Raw light-play with original sheen — the assassin mantis under Team Rocket's command.",
    views: 187,
  },
  // --- Neo Revelation (Shining rares) ---
  {
    id: "shining-magikarp-neo",
    name: "Shining Magikarp",
    pokemonId: 129,
    set: "Neo Revelation",
    year: 2001,
    number: "66/64",
    rarity: "Shining Holo",
    condition: "PSA 10",
    price: 2100,
    type: "Water",
    imageUrl: tcgCardImage("neo3", "66"),
    description:
      "Neo Revelation Shining Magikarp in Gem Mint PSA 10. The reverse-holo treatment makes the goldfish absolutely pop.",
    views: 423,
  },
  {
    id: "shining-gyarados-neo",
    name: "Shining Gyarados",
    pokemonId: 130,
    set: "Neo Revelation",
    year: 2001,
    number: "65/64",
    rarity: "Shining Holo",
    condition: "PSA 10",
    price: 4200,
    type: "Water",
    imageUrl: tcgCardImage("neo3", "65"),
    description:
      "Neo Revelation Shining Gyarados in Gem Mint PSA 10. The crown jewel of the Shining subset — wrathful, foil-soaked, perfect.",
    views: 612,
  },
];

// ---------------------------------------------------------------------------
// Type → badge color mapping (kept for any future card-detail views).
// ---------------------------------------------------------------------------

export function getTypeBadgeColor(type: CardType | string): string {
  switch (type) {
    case "Fire":
      return "bg-red-500 text-white";
    case "Water":
      return "bg-blue-500 text-white";
    case "Grass":
      return "bg-emerald-500 text-white";
    case "Lightning":
      return "bg-yellow-400 text-ink-black";
    case "Psychic":
      return "bg-purple-500 text-white";
    case "Metal":
      return "bg-slate-400 text-ink-black";
    case "Dark":
      return "bg-neutral-800 text-white";
    case "Colorless":
      return "bg-stone-300 text-ink-black";
    case "Dragon":
      return "bg-indigo-500 text-white";
    case "Fighting":
      return "bg-orange-700 text-white";
    case "Ground":
      return "bg-amber-600 text-white";
    case "Flying":
      return "bg-sky-300 text-ink-black";
    case "Ice":
      return "bg-cyan-300 text-ink-black";
    case "Bug":
      return "bg-lime-500 text-white";
    case "Rock":
      return "bg-stone-500 text-white";
    case "Ghost":
      return "bg-violet-600 text-white";
    case "Poison":
      return "bg-fuchsia-500 text-white";
    case "Normal":
      return "bg-gray-300 text-ink-black";
    case "Steel":
      return "bg-zinc-400 text-ink-black";
    case "Fairy":
      return "bg-pink-300 text-ink-black";
    default:
      return "bg-stone-300 text-ink-black";
  }
}

// ---------------------------------------------------------------------------
// Pokédex grid — Gen 3 / Hoenn tiles (each links to a filtered card listing).
// ---------------------------------------------------------------------------

export interface PokedexTile {
  /** Pokémon name, also used as the filter key + product-listing query. */
  name: string;
  /** National Pokédex id — drives the Gen-3 sprite URL. */
  id: number;
  /** Brief accent (tile hover background tint). */
  accentColor: string;
  /** The lowest-priced listing we hold for this Pokémon (for the price dot). */
  startingPrice: number;
  /** Condition code shown in the price dot, e.g. "PSA9". */
  startingCondition: CardCondition;
  /** Pokémon types (e.g. ["Dragon", "Flying"] for Rayquaza). */
  types: string[];
  /** Background colour for the tile — pastel of the primary type. */
  bgColor: string;
  /** Official Pokédex details: height, weight, base stats, category, ability. */
  details: PokedexDetails;
}

export interface PokedexDetails {
  /** Official Pokédex category (e.g. "Seed Pokémon"). */
  category: string;
  /** Height in meters. */
  height: string;
  /** Weight in kilograms. */
  weight: string;
  /** Base stat total. */
  baseStatTotal: number;
  /** Base HP. */
  hp: number;
  /** Base Attack. */
  attack: number;
  /** Base Defense. */
  defense: number;
  /** Base Sp. Atk. */
  spAtk: number;
  /** Base Sp. Def. */
  spDef: number;
  /** Base Speed. */
  speed: number;
  /** Primary ability. */
  ability: string;
  /** Generation introduced (e.g. "Gen I", "Gen II"). */
  generation: string;
}

/** A Gen-3-forward Pokédex tile list (Hoenn-heavy, with a few nostalgic Gen 1-2).
 * All details are official values from the National Pokédex / base stats. */
export const POKEDEX_TILES: PokedexTile[] = [
  { name: "Bulbasaur",  id: 1,   accentColor: "#85D4FF", startingPrice: 45,   startingCondition: "RAW NM", types: ["Grass", "Poison"], bgColor: "#D4F4DD",
    details: { category: "Seed Pokémon", height: "0.7 m", weight: "6.9 kg", baseStatTotal: 318, hp: 45, attack: 49, defense: 49, spAtk: 65, spDef: 65, speed: 45, ability: "Overgrow", generation: "Gen I" } },
  { name: "Ivysaur",    id: 2,   accentColor: "#85D4FF", startingPrice: 35,   startingCondition: "RAW NM", types: ["Grass", "Poison"], bgColor: "#D4F4DD",
    details: { category: "Seed Pokémon", height: "1.0 m", weight: "13.0 kg", baseStatTotal: 405, hp: 60, attack: 62, defense: 63, spAtk: 80, spDef: 80, speed: 60, ability: "Overgrow", generation: "Gen I" } },
  { name: "Venusaur",   id: 3,   accentColor: "#85D4FF", startingPrice: 1600, startingCondition: "PSA 8",  types: ["Grass", "Poison"], bgColor: "#D4F4DD",
    details: { category: "Seed Pokémon", height: "2.0 m", weight: "100.0 kg", baseStatTotal: 525, hp: 80, attack: 82, defense: 83, spAtk: 100, spDef: 100, speed: 80, ability: "Overgrow", generation: "Gen I" } },
  { name: "Charmander", id: 4,   accentColor: "#FEDD25", startingPrice: 65,   startingCondition: "RAW NM", types: ["Fire"],            bgColor: "#FFE0CC",
    details: { category: "Lizard Pokémon", height: "0.6 m", weight: "8.5 kg", baseStatTotal: 309, hp: 39, attack: 52, defense: 43, spAtk: 60, spDef: 50, speed: 65, ability: "Blaze", generation: "Gen I" } },
  { name: "Charmeleon", id: 5,   accentColor: "#FEDD25", startingPrice: 85,   startingCondition: "RAW NM", types: ["Fire"],            bgColor: "#FFE0CC",
    details: { category: "Flame Pokémon", height: "1.1 m", weight: "19.0 kg", baseStatTotal: 405, hp: 58, attack: 64, defense: 58, spAtk: 80, spDef: 65, speed: 80, ability: "Blaze", generation: "Gen I" } },
  { name: "Charizard",  id: 6,   accentColor: "#FEDD25", startingPrice: 8500, startingCondition: "PSA 9",  types: ["Fire", "Flying"],  bgColor: "#FFE0CC",
    details: { category: "Flame Pokémon", height: "1.7 m", weight: "90.5 kg", baseStatTotal: 534, hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100, ability: "Blaze", generation: "Gen I" } },
  { name: "Squirtle",   id: 7,   accentColor: "#3194EE", startingPrice: 55,   startingCondition: "RAW NM", types: ["Water"],           bgColor: "#D6EAFF",
    details: { category: "Tiny Turtle Pokémon", height: "0.5 m", weight: "9.0 kg", baseStatTotal: 314, hp: 44, attack: 48, defense: 65, spAtk: 50, spDef: 64, speed: 43, ability: "Torrent", generation: "Gen I" } },
  { name: "Wartortle",  id: 8,   accentColor: "#3194EE", startingPrice: 40,   startingCondition: "RAW NM", types: ["Water"],           bgColor: "#D6EAFF",
    details: { category: "Turtle Pokémon", height: "1.0 m", weight: "22.5 kg", baseStatTotal: 405, hp: 59, attack: 63, defense: 80, spAtk: 65, spDef: 80, speed: 58, ability: "Torrent", generation: "Gen I" } },
  { name: "Blastoise",  id: 9,   accentColor: "#3194EE", startingPrice: 2200, startingCondition: "PSA 8",  types: ["Water"],           bgColor: "#D6EAFF",
    details: { category: "Shellfish Pokémon", height: "1.6 m", weight: "85.5 kg", baseStatTotal: 530, hp: 79, attack: 83, defense: 100, spAtk: 85, spDef: 105, speed: 78, ability: "Torrent", generation: "Gen I" } },
  { name: "Pikachu",    id: 25,  accentColor: "#FEDD25", startingPrice: 45,   startingCondition: "RAW NM", types: ["Lightning"],       bgColor: "#FFF3B8",
    details: { category: "Mouse Pokémon", height: "0.4 m", weight: "6.0 kg", baseStatTotal: 320, hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90, ability: "Static", generation: "Gen I" } },
  { name: "Raichu",     id: 26,  accentColor: "#FEDD25", startingPrice: 220,  startingCondition: "RAW NM", types: ["Lightning"],       bgColor: "#FFF3B8",
    details: { category: "Mouse Pokémon", height: "0.8 m", weight: "30.0 kg", baseStatTotal: 485, hp: 60, attack: 90, defense: 55, spAtk: 90, spDef: 80, speed: 110, ability: "Static", generation: "Gen I" } },
  { name: "Psyduck",    id: 54,  accentColor: "#3194EE", startingPrice: 35,   startingCondition: "RAW NM", types: ["Water"],           bgColor: "#D6EAFF",
    details: { category: "Duck Pokémon", height: "0.8 m", weight: "19.6 kg", baseStatTotal: 320, hp: 50, attack: 52, defense: 48, spAtk: 65, spDef: 50, speed: 55, ability: "Damp", generation: "Gen I" } },
  { name: "Koffing",    id: 109, accentColor: "#FFD6E0", startingPrice: 28,   startingCondition: "RAW LP", types: ["Poison"],          bgColor: "#F5D7FF",
    details: { category: "Poison Gas Pokémon", height: "0.6 m", weight: "1.0 kg", baseStatTotal: 340, hp: 40, attack: 65, defense: 95, spAtk: 60, spDef: 45, speed: 35, ability: "Levitate", generation: "Gen I" } },
  { name: "Magikarp",   id: 129, accentColor: "#3194EE", startingPrice: 80,   startingCondition: "RAW NM", types: ["Water"],           bgColor: "#D6EAFF",
    details: { category: "Fish Pokémon", height: "0.9 m", weight: "10.0 kg", baseStatTotal: 200, hp: 20, attack: 10, defense: 55, spAtk: 15, spDef: 20, speed: 80, ability: "Swift Swim", generation: "Gen I" } },
  { name: "Mewtwo",     id: 150, accentColor: "#FFD6E7", startingPrice: 3400, startingCondition: "PSA 10", types: ["Psychic"],         bgColor: "#F0E0FF",
    details: { category: "Genetic Pokémon", height: "2.0 m", weight: "122.0 kg", baseStatTotal: 680, hp: 106, attack: 110, defense: 90, spAtk: 154, spDef: 90, speed: 130, ability: "Pressure", generation: "Gen I" } },
  { name: "Wooper",     id: 194, accentColor: "#3194EE", startingPrice: 30,   startingCondition: "RAW NM", types: ["Water", "Ground"], bgColor: "#D6EAFF",
    details: { category: "Water Fish Pokémon", height: "0.4 m", weight: "8.5 kg", baseStatTotal: 310, hp: 55, attack: 45, defense: 45, spAtk: 25, spDef: 25, speed: 15, ability: "Damp", generation: "Gen II" } },
  { name: "Wobbuffet",  id: 202, accentColor: "#3194EE", startingPrice: 38,   startingCondition: "RAW NM", types: ["Psychic"],         bgColor: "#F0E0FF",
    details: { category: "Patient Pokémon", height: "1.3 m", weight: "28.5 kg", baseStatTotal: 405, hp: 190, attack: 33, defense: 58, spAtk: 33, spDef: 58, speed: 33, ability: "Shadow Tag", generation: "Gen II" } },
];

// ---------------------------------------------------------------------------
// Binder pages — grouped by set era (the brief's "flip through a binder" idea).
// ---------------------------------------------------------------------------

export interface BinderTab {
  id: string;
  label: string; // e.g. "Hoenn · Gen 3"
  /** Cards shown on this binder page (front side of the page). */
  cards: ShopCard[];
}

/**
 * Group the shared SHOP_CARDS into era-labelled binder pages.
 *
 * Each tab represents a Gen 1 TCG era:
 *   - Base Set (1999): the iconic holo rares
 *   - Team Rocket (2000): the Dark Pokémon subset
 *   - Neo Revelation (2001): the Shining rares
 */
function buildBinderTabs(): BinderTab[] {
  const baseSet = SHOP_CARDS.filter((c) =>
    ["Charizard", "Blastoise", "Venusaur", "Mewtwo", "Pikachu", "Raichu", "Gyarados"].includes(c.name) &&
    c.set === "Base Set",
  );
  const teamRocket = SHOP_CARDS.filter((c) =>
    c.set === "Team Rocket",
  );
  const neo = SHOP_CARDS.filter((c) =>
    c.set === "Neo Revelation" ||
    (c.set === "Base Set" && ["Pikachu", "Raichu", "Gyarados"].includes(c.name)),
  );

  return [
    { id: "base-set", label: "Base Set · 1999", cards: baseSet },
    { id: "team-rocket", label: "Team Rocket · 2000", cards: teamRocket },
    { id: "neo-revelation", label: "Neo · 2001", cards: neo },
  ];
}

export const BINDER_TABS: BinderTab[] = buildBinderTabs();

// ---------------------------------------------------------------------------
// Hero fan — the featured "hero card" (front of the fan) + two backers.
// ---------------------------------------------------------------------------

/** The front card of the fan — the single most expensive listing. */
export function pickHeroFanCards(): {
  front: ShopCard;
  middle: ShopCard;
  back: ShopCard;
} {
  const sorted = [...SHOP_CARDS].sort((a, b) => b.price - a.price);
  return {
    front: sorted[0], // most expensive (e.g. Blaziken ex)
    middle: sorted[1],
    back: sorted[2],
  };
}

// ---------------------------------------------------------------------------
// Plain <img> is used for all CDN sprites (rather than next/image) so we can
// pin `image-rendering: pixelated` for the authentic GBA sprite look on the
// Pokédex grid. No local image imports are needed anywhere in this app.
// ---------------------------------------------------------------------------
