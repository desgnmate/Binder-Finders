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
  it("requires a store currency before enabling guest checkout", () => {
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        guestCheckoutEnabled: true,
      }).success,
    ).toBe(false);

    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        guestCheckoutEnabled: true,
        currency: "AUD",
      }).success,
    ).toBe(true);
  });
  it("defaults legacy store settings to disabled guest checkout and unconfigured shipping", () => {
    const { guestCheckoutEnabled, shippingFeeCents, ...legacy } = defaultSettings;
    const parsed = settingsSchema.parse(legacy);
    expect(parsed.guestCheckoutEnabled).toBe(false);
    expect(parsed.shippingFeeCents).toBeNull();
  });

  it("defaults legacy store settings to a 60 minute guest checkout duration", () => {
    const { guestCheckoutDurationMinutes, ...legacy } = defaultSettings;
    const parsed = settingsSchema.parse(legacy);
    expect(parsed.guestCheckoutDurationMinutes).toBe(60);
  });

  it.each([0, 59, 1441, 12.5, Infinity, NaN])(
    "rejects invalid guest checkout duration minutes: %s",
    (guestCheckoutDurationMinutes) => {
      expect(
        settingsSchema.safeParse({
          ...defaultSettings,
          guestCheckoutDurationMinutes,
        }).success,
      ).toBe(false);
    },
  );

  it.each([60, 90, 1440])(
    "accepts valid guest checkout duration minutes: %s",
    (guestCheckoutDurationMinutes) => {
      const parsed = settingsSchema.parse({
        ...defaultSettings,
        guestCheckoutDurationMinutes,
      });
      expect(parsed.guestCheckoutDurationMinutes).toBe(
        guestCheckoutDurationMinutes,
      );
    },
  );

  it.each([-1, 12.5, 1000000001, Infinity, NaN])(
    "rejects invalid guest shipping fee cents: %s",
    (shippingFeeCents) => {
      expect(
        settingsSchema.safeParse({ ...defaultSettings, shippingFeeCents }).success,
      ).toBe(false);
    },
  );

  it("accepts explicitly configured free or paid shipping", () => {
    for (const shippingFeeCents of [0, 1250]) {
      const parsed = settingsSchema.parse({ ...defaultSettings, shippingFeeCents });
      expect(parsed.shippingFeeCents).toBe(shippingFeeCents);
    }
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
