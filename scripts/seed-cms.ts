import { createClient } from "@supabase/supabase-js";
import { SHOP_CARDS, BINDER_TABS } from "../lib/data";
import { defaultSettings } from "../lib/cms/types";
async function main() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL !==
    "https://zovjsqrcfcnptcihzmlw.supabase.co"
  )
    throw new Error("Unexpected project; refusing import");
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new Error("SUPABASE_SECRET_KEY is required");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } },
  );
  const check = await db
    .from("cards")
    .select("id", { count: "exact", head: true });
  if (check.error)
    throw new Error("Apply the CMS schema migration before importing");
  if (check.count)
    throw new Error(
      "Catalog is not empty; refusing to overwrite existing listings",
    );
  const rows = SHOP_CARDS.map((c, i) => {
    const { id, price, availability, ...data } = c;
    return {
      id,
      data: { ...data, additionalImages: [] },
      price_cents: Math.round(price * 100),
      availability: availability || "available",
      publication: "published",
      featured_order: i,
    };
  });
  const { error } = await db.from("cards").insert(rows);
  if (error) throw error;
  for (const [index, tab] of BINDER_TABS.entries()) {
    const { error: ce } = await db
      .from("collections")
      .insert({ id: tab.id, name: tab.label, sort_order: index });
    if (ce) throw ce;
    const { error: me } = await db
      .from("collection_cards")
      .insert(
        tab.cards.map((c, i) => ({
          collection_id: tab.id,
          card_id: c.id,
          sort_order: i,
        })),
      );
    if (me) throw me;
  }
  const { error: se } = await db
    .from("store_settings")
    .insert({ id: true, data: defaultSettings });
  if (se) throw se;
  const { data: imported, error: ve } = await db
    .from("cards")
    .select("id,price_cents");
  if (ve) throw ve;
  if (
    imported?.length !== SHOP_CARDS.length ||
    SHOP_CARDS.some(
      (c) =>
        !imported.find(
          (r) => r.id === c.id && r.price_cents === Math.round(c.price * 100),
        ),
    )
  )
    throw new Error("Import verification failed");
  console.log(
    `Verified ${imported.length} listings with original IDs and prices. Holds remain disabled pending store configuration.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
