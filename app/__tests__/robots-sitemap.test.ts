import robots from "../robots";
import sitemap from "../sitemap";

jest.mock("../../lib/cms/catalog", () => ({
  getCatalog: async () => ({
    cards: [
      { id: "charizard-base1", imageUrl: "https://images.example.test/4.png", availability: "available", updatedAt: "2026-11-01T00:00:00Z" },
      { id: "mewtwo-base1", imageUrl: "/scans/mewtwo.jpg", availability: "sold" },
    ],
  }),
}));

const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env, NEXT_PUBLIC_SITE_URL: "https://shop.example.test", VERCEL_ENV: "production" };
});
afterAll(() => {
  process.env = env;
});

describe("robots.txt", () => {
  it("keeps private pages out and points to the sitemap", () => {
    const result = robots();
    expect(result.rules).toMatchObject({ allow: "/", disallow: ["/admin", "/account", "/checkout", "/api/", "/auth/"] });
    expect(result.sitemap).toBe("https://shop.example.test/sitemap.xml");
  });

  it("blocks everything on preview deployments", () => {
    process.env.VERCEL_ENV = "preview";
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("sitemap.xml", () => {
  it("lists the main pages and every published card", async () => {
    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual([
      "https://shop.example.test/",
      "https://shop.example.test/shop",
      "https://shop.example.test/pokedex",
      "https://shop.example.test/about",
      "https://shop.example.test/how-holds-work",
      "https://shop.example.test/contact",
      "https://shop.example.test/shipping-returns",
      "https://shop.example.test/privacy",
      "https://shop.example.test/terms",
      "https://shop.example.test/cards/charizard-base1",
      "https://shop.example.test/cards/mewtwo-base1",
    ]);
    expect(entries[9]).toMatchObject({ lastModified: new Date("2026-11-01T00:00:00Z"), images: ["https://images.example.test/4.png"], priority: 0.8 });
    expect(entries[10]).toMatchObject({ images: ["https://shop.example.test/scans/mewtwo.jpg"], priority: 0.3 });
    expect(entries[10]).not.toHaveProperty("lastModified");
  });
});
