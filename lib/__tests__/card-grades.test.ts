import { CONDITIONS, RARITIES, conditionRank, normalizeCondition, normalizeRarity, rarityRank } from "../card-grades";
import { cardSchema, fromRow } from "../cms/types";

describe("card conditions and rarities", () => {
  it("lists conditions in the store's order, then graded slabs", () => {
    expect(CONDITIONS.slice(0, 11)).toEqual(["Mint", "NM+", "NM", "NM-", "LP+", "LP", "LP-", "MP+", "MP", "HP", "DMG"]);
    expect(CONDITIONS).toContain("PSA 10");
    expect(RARITIES).toEqual(["Holo Rare", "Rare", "Uncommon", "Common"]);
  });

  it("maps values saved before the new lists", () => {
    expect(normalizeCondition("RAW NM")).toBe("NM");
    expect(normalizeCondition("RAW LP")).toBe("LP");
    expect(normalizeCondition("PSA 9")).toBe("PSA 9");
    expect(normalizeRarity("Rare Holo")).toBe("Holo Rare");
    expect(normalizeRarity("Shining Holo")).toBe("Holo Rare");
  });

  it("reads and validates older saved cards", () => {
    const row = { id: "x", price_cents: 100, publication: "published", availability: "available", featured_order: null, updated_at: null, data: { condition: "RAW NM", rarity: "Shining Holo" } };
    expect(fromRow(row)).toMatchObject({ condition: "NM", rarity: "Holo Rare" });
    const parsed = cardSchema.safeParse({
      id: "x", name: "X", pokemonId: 1, set: "Base", year: 1999, number: "1", rarity: "Rare Holo", condition: "RAW LP", type: "Grass", price: 1,
      imageUrl: "", backImageUrl: "", additionalImages: [], description: "", publication: "draft", availability: "available", featuredOrder: null,
    });
    expect(parsed.success && parsed.data).toMatchObject({ condition: "LP", rarity: "Holo Rare" });
    expect(cardSchema.shape.condition.safeParse("Excellent").success).toBe(false);
  });

  it("sorts best first", () => {
    expect(conditionRank("Mint")).toBeLessThan(conditionRank("DMG"));
    expect(conditionRank("RAW NM")).toBe(conditionRank("NM"));
    expect(rarityRank("Holo Rare")).toBeLessThan(rarityRank("Common"));
  });
});
