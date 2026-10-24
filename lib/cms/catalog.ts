import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { SHOP_CARDS, BINDER_TABS } from "../data";
import { publicClient } from "../supabase/server";
import {
  defaultSettings,
  fromRow,
  type Catalog,
  type Collection,
  settingsSchema,
} from "./types";
const getCachedCatalog = unstable_cache(async (): Promise<Catalog> => {
  // Explicit migration switch. Never restore sample stock after activation.
  if (process.env.CMS_ENABLED !== "true")
    return {
      cards: SHOP_CARDS,
      collections: BINDER_TABS.map((t, i) => ({
        id: t.id,
        name: t.label,
        sortOrder: i,
        cardIds: t.cards.map((c) => c.id),
      })),
      settings: defaultSettings,
      source: "seed",
    };
  try {
    const db = publicClient();
    const [cards, collections, settings] = await Promise.all([
      db
        .from("cards")
        .select("*")
        .eq("publication", "published")
        .order("created_at"),
      db
        .from("collections")
        .select("*,collection_cards(card_id,sort_order)")
        .order("sort_order"),
      db.from("store_settings").select("data").eq("id", true).single(),
    ]);
    if (cards.error || collections.error || settings.error)
      throw new Error("Catalog query failed");
    return {
      cards: cards.data.map((row) => ({ ...fromRow(row), views: 0 })),
      collections: collections.data.map(
        (row) =>
          ({
            id: row.id,
            name: row.name,
            sortOrder: row.sort_order,
            cardIds: row.collection_cards
              .sort(
                (a: { sort_order: number }, b: { sort_order: number }) =>
                  a.sort_order - b.sort_order,
              )
              .map((m: { card_id: string }) => m.card_id),
          }) as Collection,
      ),
      settings: settingsSchema.parse(settings.data.data),
      source: "supabase",
    };
  } catch {
    console.error("CMS catalog could not be loaded");
    return {
      cards: [],
      collections: [],
      settings: defaultSettings,
      source: "unavailable",
    };
  }
}, ["binder-finders-catalog-v1"], { revalidate: 15, tags: ["store-catalog"] });

// Deduplicate calls made by the layout and page during the same render while
// sharing the short-lived public catalog cache across navigations/requests.
export const getCatalog = cache(() => getCachedCatalog());
