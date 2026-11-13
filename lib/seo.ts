import type { Metadata } from "next";
import { formatPrice, isCardAvailable, type ShopCard } from "./data";

export const SITE_NAME = "BinderFinders";
export const DEFAULT_TITLE = "BinderFinders — Home of Vintage Pokemon Cards";
export const DEFAULT_DESCRIPTION =
  "Browse our collection of graded and raw Hoenn-era collectibles from Binders to Gem Mint Singles. Flatbed scanned, certified centering.";
export const SHARE_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "BinderFinders — vintage Pokémon cards" };

const LIVE_SITE = "https://www.binderfinders.com";

/**
 * The public address search engines should use, without a trailing slash.
 * A *.vercel.app address is never the shop's real address, so it falls back
 * to the live domain rather than sending Google somewhere else.
 */
export function siteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (!configured || /\.vercel\.app$/i.test(configured)) return LIVE_SITE;
  return configured;
}

/**
 * Only the live site should appear in search results. Vercel preview builds
 * and local development set VERCEL_ENV / NODE_ENV to something else.
 */
export function isIndexable() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export function absoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** The card's own page. The shop's popup view points search engines here. */
export function cardPath(id: string) {
  return `/cards/${encodeURIComponent(id)}`;
}

export function cardTitle(card: ShopCard) {
  return `${card.name} – ${card.set} ${card.number} (${card.condition})`;
}

function availabilityText(card: ShopCard) {
  if (card.availability === "sold") return "Sold";
  if (card.availability === "reserved") return "On hold";
  if (!isCardAvailable(card)) return "Unavailable";
  return "Available now";
}

export function cardDescription(card: ShopCard, currency = "") {
  const price = currency && card.price > 0 ? ` ${formatPrice(card.price, `${currency} `)}.` : "";
  const summary = `${card.name} from ${card.set} (${card.year}), card ${card.number}, ${card.rarity}, ${card.condition}. ${availabilityText(card)}.${price}`;
  const extra = card.description?.trim() ? ` ${card.description.trim()}` : " Real flatbed scans of the actual card.";
  return truncate(summary + extra, 300);
}

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/**
 * Full metadata for one page. Open Graph and Twitter settings replace the
 * parent's rather than merging, so every page sets them all.
 */
export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  images,
  absoluteTitle = false,
}: {
  title: string;
  description?: string;
  /** Leave out only for site-wide defaults that every page inherits. */
  path?: string;
  images?: { url: string; alt?: string; width?: number; height?: number }[];
  absoluteTitle?: boolean;
}): Metadata {
  const shareImages = images?.length ? images : [SHARE_IMAGE];
  const shareTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_AU",
      ...(path ? { url: path } : {}),
      title: shareTitle,
      description,
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: shareImages.map((image) => image.url),
    },
  };
}

export function cardMetadata(card: ShopCard, currency = ""): Metadata {
  const image = card.imageUrl ? [{ url: absoluteUrl(card.imageUrl), alt: `${card.name} card scan` }] : undefined;
  return pageMetadata({
    title: cardTitle(card),
    description: cardDescription(card, currency),
    path: cardPath(card.id),
    images: image,
  });
}

const AVAILABILITY: Record<NonNullable<ShopCard["availability"]>, string> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
  unavailable: "https://schema.org/OutOfStock",
};

/** Product details Google can show in search results (price, stock, photo). */
export function productJsonLd(card: ShopCard & { additionalImages?: string[] }, currency = "") {
  const url = absoluteUrl(cardPath(card.id));
  const images = [card.imageUrl, card.backImageUrl, ...(card.additionalImages || [])]
    .filter((src): src is string => Boolean(src))
    .map(absoluteUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${card.name} ${card.set} ${card.number}`,
    sku: card.id,
    url,
    ...(images.length ? { image: images } : {}),
    description: cardDescription(card),
    category: "Collectible Trading Cards",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Set", value: card.set },
      { "@type": "PropertyValue", name: "Card number", value: card.number },
      { "@type": "PropertyValue", name: "Year", value: String(card.year) },
      { "@type": "PropertyValue", name: "Rarity", value: card.rarity },
      { "@type": "PropertyValue", name: "Condition", value: card.condition },
    ],
    ...(currency && card.price > 0
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: card.price.toFixed(2),
            priceCurrency: currency,
            availability: AVAILABILITY[card.availability || "available"],
            itemCondition: "https://schema.org/UsedCondition",
            seller: { "@type": "Organization", name: SITE_NAME },
          },
        }
      : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function storeJsonLd({ description, location }: { description?: string; location?: string }) {
  const url = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Store",
      "@id": `${url}/#store`,
      name: SITE_NAME,
      url,
      logo: absoluteUrl("/images/logo.png"),
      image: absoluteUrl(SHARE_IMAGE.url),
      ...(description ? { description } : {}),
      ...(location ? { address: location } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}/#website`,
      name: SITE_NAME,
      url,
      publisher: { "@id": `${url}/#store` },
    },
  ];
}
