import { cardSchema, settingsSchema, defaultSettings, fromRow } from "../types";
import { catalogPokemon } from "../pokemon";
import { SHOP_CARDS } from "../../data";

const card = {
  ...SHOP_CARDS[0],
  publication: "draft",
  availability: "available",
  imageUrl: "",
  price: 12.34,
  featuredOrder: null,
};

describe("CMS listing safeguards", () => {
  it("allows unfinished draft images but requires a front image to publish", () => {
    expect(cardSchema.safeParse(card).success).toBe(true);
    expect(
      cardSchema.safeParse({ ...card, publication: "published" }).success,
    ).toBe(false);
    expect(
      cardSchema.safeParse({
        ...card,
        publication: "published",
        imageUrl: "/images/logo.png",
      }).success,
    ).toBe(true);
  });
  it.each([-1, 12.345, Infinity, NaN])(
    "rejects invalid prices: %s",
    (price) => {
      expect(cardSchema.safeParse({ ...card, price }).success).toBe(false);
    },
  );
  it.each([
    "javascript:alert(1)",
    "//untrusted.example/x.png",
    "http://example.com/x.png",
  ])("rejects unsafe image addresses: %s", (imageUrl) => {
    expect(cardSchema.safeParse({ ...card, imageUrl }).success).toBe(false);
  });
  it("requires an explicit currency before customer holds are enabled", () => {
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
    expect(
      settingsSchema.safeParse({ ...defaultSettings, holdsEnabled: true })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        holdsEnabled: true,
        currency: "AUD",
      }).success,
    ).toBe(true);
  });
  it("takes price and availability from authoritative columns, not JSON", () => {
    const converted = fromRow({
      id: "test",
      data: { price: 1, availability: "available" },
      price_cents: 1234,
      availability: "sold",
      publication: "published",
      featured_order: 2,
      updated_at: "timestamp",
    });
    expect(converted).toMatchObject({
      id: "test",
      price: 12.34,
      availability: "sold",
      featuredOrder: 2,
      updatedAt: "timestamp",
    });
  });
  it("adds newly listed species to the Pokédex without duplicates", () => {
    const newCard = { ...SHOP_CARDS[0], pokemonId: 252 };
    const dex = catalogPokemon([newCard, newCard]);
    expect(dex.filter((p) => p.id === 252)).toEqual([
      {
        id: 252,
        name: "Treecko",
        types: ["Grass"],
        details: { generation: "Gen III" },
      },
    ]);
  });
});
