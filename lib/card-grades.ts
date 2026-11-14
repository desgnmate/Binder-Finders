// Card condition and rarity, in the order the store lists them. Change them
// here and the card editor, storefront and sorting all follow.

/** Raw (ungraded) conditions, best first. */
export const RAW_CONDITIONS = ["Mint", "NM+", "NM", "NM-", "LP+", "LP", "LP-", "MP+", "MP", "HP", "DMG"] as const;

/** Professionally graded slabs, best first. */
export const GRADED_CONDITIONS = [
  "PSA 10",
  "PSA 9",
  "PSA 8",
  "PSA 7",
  "PSA 6",
  "PSA 5",
  "PSA 4",
  "PSA 3",
  "PSA 2",
  "PSA 1",
] as const;

export const CONDITIONS = [...RAW_CONDITIONS, ...GRADED_CONDITIONS] as const;

/** Rarity, highest first. */
export const RARITIES = ["Holo Rare", "Rare", "Uncommon", "Common"] as const;

export type CardCondition = (typeof CONDITIONS)[number];
export type CardRarity = (typeof RARITIES)[number];

// Values saved before the store's own lists existed.
const LEGACY_CONDITIONS: Record<string, CardCondition> = {
  "RAW NM": "NM",
  "RAW LP": "LP",
};
const LEGACY_RARITIES: Record<string, CardRarity> = {
  "Rare Holo": "Holo Rare",
  "Shining Holo": "Holo Rare",
  "Ultra Rare": "Holo Rare",
  "Secret Rare": "Holo Rare",
};

/** Maps older saved values to the current list. Anything else is returned unchanged. */
export function normalizeCondition(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return LEGACY_CONDITIONS[trimmed] ?? trimmed;
}

export function normalizeRarity(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return LEGACY_RARITIES[trimmed] ?? trimmed;
}

/** Position in the store's list (0 = best). Unknown values sort last. */
export function conditionRank(value: string) {
  const index = (CONDITIONS as readonly string[]).indexOf(String(normalizeCondition(value)));
  return index === -1 ? CONDITIONS.length : index;
}

export function rarityRank(value: string) {
  const index = (RARITIES as readonly string[]).indexOf(String(normalizeRarity(value)));
  return index === -1 ? RARITIES.length : index;
}

export function isGraded(condition: string) {
  return /^PSA \d+$/.test(condition);
}
