import { notFound } from "next/navigation";
import AdminLayout from "../admin/layout";
import { AdminConsole } from "../../components/admin/AdminConsole";
import { defaultSettings, type CMSCard, type Hold } from "../../lib/cms/types";

// Temporary visual QA fixture. No customer records or authentication bypass.
export default async function Preview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view = "dashboard" } = await searchParams;
  const card: CMSCard = { id: "sample-charizard", name: "Charizard", pokemonId: 6, set: "Base Set", year: 1999, number: "4/102", rarity: "Rare Holo", condition: "PSA 8", type: "Fire", price: 8500, imageUrl: "", backImageUrl: "", additionalImages: [], description: "Example listing for local visual checks", publication: "published", availability: "reserved", featuredOrder: null };
  const cards: CMSCard[] = [card, { ...card, id: "sample-blastoise", name: "Blastoise", number: "2/102", price: 2200, type: "Water" }, { ...card, id: "sample-pikachu", name: "Pikachu", number: "58/102", condition: "RAW NM", price: 45, availability: "available" }];
  const hold: Hold = { id: "11111111-1111-4111-8111-111111111111", name: "Sample Collector", email: "collector@example.test", note: "Could I see a closer scan before collection?", status: "accepted", payment_status: "pending", fulfillment_status: "not_ready", currency: "AUD", expires_at: "2026-10-22T00:57:00Z", created_at: "2026-10-20T02:50:00Z", hold_request_items: cards.slice(0,2).map(c => ({ card_id: c.id, name: c.name, price_cents: c.price * 100 })) };
  return <AdminLayout><AdminConsole view={view} user={{ id: "sample", email: "manager@example.test", role: "owner" }} cards={cards} collectionCards={cards} collections={[{ id: "base-set", name: "Base Set", sortOrder: 0, cardIds: cards.map(c => c.id) }]} settings={{ ...defaultSettings, currency: "AUD", holdsEnabled: true }} settingsUpdatedAt="" holds={[hold]} audit={[]} admins={[]} pendingHoldCount={0} stats={{ available: 14, reserved: 2, drafts: 0, sold: 0, newRequests: 0 }} live stripeReady /></AdminLayout>;
}
