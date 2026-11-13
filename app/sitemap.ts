import type { MetadataRoute } from "next";
import { getCatalog } from "../lib/cms/catalog";
import { absoluteUrl, cardPath, siteUrl } from "../lib/seo";

// New and sold cards should show up without waiting for a redeploy.
export const dynamic = "force-dynamic";

const INFO_PAGES = ["/about", "/how-holds-work", "/contact", "/shipping-returns", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { cards } = await getCatalog();
  const base = siteUrl();
  const cardEntries: MetadataRoute.Sitemap = cards.map((card) => {
    const updatedAt = (card as { updatedAt?: string | null }).updatedAt;
    return {
      url: `${base}${cardPath(card.id)}`,
      ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
      changeFrequency: "weekly",
      priority: card.availability === "sold" ? 0.3 : 0.8,
      ...(card.imageUrl ? { images: [absoluteUrl(card.imageUrl)] } : {}),
    };
  });
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/pokedex`, changeFrequency: "monthly", priority: 0.5 },
    ...INFO_PAGES.map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...cardEntries,
  ];
}
