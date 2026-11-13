import { SHOP_CARDS } from "../data";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  cardMetadata,
  cardPath,
  isIndexable,
  pageMetadata,
  productJsonLd,
} from "../seo";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

const card = { ...SHOP_CARDS[0], id: "charizard base/1", price: 85, availability: "available" as const };

describe("seo helpers", () => {
  it("only lets the live Vercel site be indexed", () => {
    process.env = { ...env, VERCEL_ENV: "production" };
    expect(isIndexable()).toBe(true);
    process.env = { ...env, VERCEL_ENV: "preview" };
    expect(isIndexable()).toBe(false);
    process.env = { ...env, VERCEL_ENV: "", NODE_ENV: "development" };
    expect(isIndexable()).toBe(false);
  });

  it("builds absolute and card URLs from the site address", () => {
    process.env = { ...env, NEXT_PUBLIC_SITE_URL: "https://shop.example.test/" };
    expect(absoluteUrl("/og-image.png")).toBe("https://shop.example.test/og-image.png");
    expect(absoluteUrl("https://images.example.test/a.png")).toBe("https://images.example.test/a.png");
    expect(cardPath(card.id)).toBe("/cards/charizard%20base%2F1");
  });

  it("never sends search engines to a vercel.app address", () => {
    process.env = { ...env, NEXT_PUBLIC_SITE_URL: "https://binder-finders.vercel.app" };
    expect(absoluteUrl("/shop")).toBe("https://www.binderfinders.com/shop");
    process.env = { ...env, NEXT_PUBLIC_SITE_URL: "" };
    expect(absoluteUrl("/shop")).toBe("https://www.binderfinders.com/shop");
  });

  it("gives every page its own canonical and share settings", () => {
    const meta = pageMetadata({ title: "Pokédex", path: "/pokedex" });
    expect(meta.alternates).toEqual({ canonical: "/pokedex" });
    expect(meta.openGraph).toMatchObject({ url: "/pokedex", title: "Pokédex | BinderFinders", siteName: "BinderFinders" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: ["/og-image.png"] });
  });

  it("leaves the canonical out of site-wide defaults", () => {
    const meta = pageMetadata({ title: "BinderFinders", absoluteTitle: true });
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).not.toHaveProperty("url");
    expect(meta.title).toEqual({ absolute: "BinderFinders" });
  });

  it("describes a card with its scan, price and canonical address", () => {
    const meta = cardMetadata(card, "AUD");
    expect(meta.title).toBe(`${card.name} – ${card.set} ${card.number} (${card.condition})`);
    expect(meta.description).toContain("Available now. AUD 85.");
    expect(meta.alternates).toEqual({ canonical: cardPath(card.id) });
    expect(meta.openGraph).toMatchObject({ images: [{ url: card.imageUrl }] });
  });

  it("marks up the card as a product with an offer", () => {
    const data = productJsonLd({ ...card, backImageUrl: "/scans/back.jpg" }, "AUD") as Record<string, any>;
    expect(data["@type"]).toBe("Product");
    expect(data.image).toEqual([card.imageUrl, absoluteUrl("/scans/back.jpg")]);
    expect(data.offers).toMatchObject({
      price: "85.00",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
    });
  });

  it.each([
    ["reserved", "https://schema.org/LimitedAvailability"],
    ["sold", "https://schema.org/SoldOut"],
    ["unavailable", "https://schema.org/OutOfStock"],
  ] as const)("reports %s cards to search engines", (availability, schema) => {
    expect((productJsonLd({ ...card, availability }, "AUD") as any).offers.availability).toBe(schema);
  });

  it("leaves the offer out until the store has a currency", () => {
    expect(productJsonLd(card, "")).not.toHaveProperty("offers");
  });

  it("numbers breadcrumbs from the home page", () => {
    process.env = { ...env, NEXT_PUBLIC_SITE_URL: "https://shop.example.test" };
    const data = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }]);
    expect(data.itemListElement[1]).toEqual({ "@type": "ListItem", position: 2, name: "Shop", item: "https://shop.example.test/shop" });
  });
});
