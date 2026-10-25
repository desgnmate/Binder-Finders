import { notFound } from "next/navigation";
import AdminLayout from "../admin/layout";
import { AdminConsole } from "../../components/admin/AdminConsole";
import { defaultSettings, type CMSCard, type Hold } from "../../lib/cms/types";

// Temporary visual QA fixture. No customer records or authentication bypass.
export default async function Preview({ searchParams }: { searchParams: Promise<{ view?: string; hold?: string; role?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view = "dashboard", hold: holdId, role = "owner" } = await searchParams;
  const now = Date.now();
  const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
  const card: CMSCard = { id: "sample-charizard", name: "Charizard", pokemonId: 6, set: "Base Set", year: 1999, number: "4/102", rarity: "Rare Holo", condition: "PSA 8", type: "Fire", price: 8500, imageUrl: "", backImageUrl: "", additionalImages: [], description: "Example listing for local visual checks", publication: "published", availability: "reserved", featuredOrder: null, updatedAt: at(-100) };
  const cards: CMSCard[] = [
    card,
    { ...card, id: "sample-blastoise", name: "Blastoise", number: "2/102", price: 2200, type: "Water" },
    { ...card, id: "sample-pikachu", name: "Pikachu", number: "58/102", condition: "RAW NM", rarity: "Common", price: 45, availability: "available", type: "Lightning" },
    { ...card, id: "sample-venusaur", name: "Venusaur", number: "15/102", condition: "PSA 9", price: 1850, publication: "draft", availability: "available", type: "Grass" },
    { ...card, id: "sample-mewtwo", name: "Mewtwo", number: "10/102", condition: "RAW LP", price: 320, availability: "sold", type: "Psychic" },
    { ...card, id: "sample-gengar", name: "Gengar", set: "Fossil", number: "5/62", condition: "PSA 10", price: 1240, availability: "available", type: "Psychic" },
  ];
  const items = (list: CMSCard[]) => list.map((c) => ({ card_id: c.id, name: c.name, price_cents: c.price * 100 }));
  const holds: Hold[] = [
    { id: "11111111-1111-4111-8111-111111111111", name: "Sample Collector", email: "collector@example.test", note: "Could I see a closer scan before collection?", status: "accepted", payment_status: "pending", fulfillment_status: "not_ready", currency: "AUD", expires_at: at(5), created_at: at(-50), hold_request_items: items(cards.slice(0, 2)),
      hold_status_history: [{ id: 1, from_status: null, to_status: "pending", actor_kind: "customer", note: null, created_at: at(-50) }, { id: 2, from_status: "pending", to_status: "accepted", actor_kind: "admin", note: null, created_at: at(-43) }] },
    { id: "2a4c91f0-1111-4111-8111-111111111111", name: "Mia Torres", email: "mia@example.test", note: "", status: "pending", payment_status: "unpaid", fulfillment_status: "not_ready", currency: "AUD", created_at: at(-1), hold_request_items: items([cards[2]]) },
    { id: "7c024b1d-1111-4111-8111-111111111111", name: "Daniel Okafor", email: "daniel@example.test", note: "", status: "accepted", payment_status: "paid", paid_at: at(-20), fulfillment_status: "not_ready", currency: "AUD", expires_at: at(30), created_at: at(-72), hold_request_items: items([cards[5]]) },
    { id: "5e190a3c-1111-4111-8111-111111111111", name: "Priya Nair", email: "priya@example.test", note: "", status: "completed", payment_status: "paid", fulfillment_status: "picked_up", currency: "AUD", created_at: at(-200), hold_request_items: items([cards[4]]) },
  ];
  const attention = holds.filter((h) => h.status === "pending" || h.status === "accepted");
  const trend = [2, 3, 1, 4, 3, 6, 4, 5].map((received, i) => ({ start: new Date(now - (8 - i) * 7 * 86_400_000).toISOString(), received, completed: Math.max(0, received - 2) }));
  const admins = [{ user_id: "sample", email: "manager@example.test", role: "owner" as const, active: true }, { user_id: "editor", email: "sam@example.test", role: "editor" as const, active: true }];
  const audit = [{ id: 2, table_name: "cards", record_id: "sample-charizard", actor_id: "sample", created_at: at(-3), old_data: { price_cents: 800000, data: { name: "Charizard" } }, new_data: { price_cents: 850000, data: { name: "Charizard" } } }, { id: 1, table_name: "hold_requests", record_id: holds[1].id, actor_id: null, created_at: at(-1), old_data: null, new_data: { name: "Mia Torres" } }];
  return <AdminLayout><AdminConsole view={view} initialHoldId={holdId} user={{ id: "sample", email: "manager@example.test", role: role === "editor" ? "editor" : "owner" }} cards={cards} collectionCards={cards} collections={[{ id: "base-set", name: "Base Set", sortOrder: 0, cardIds: cards.slice(0, 3).map(c => c.id), updatedAt: at(-10) }, { id: "graded-gems", name: "Graded gems", sortOrder: 1, cardIds: [cards[3].id, cards[5].id], updatedAt: at(-30) }]} settings={{ ...defaultSettings, currency: "AUD", holdsEnabled: true }} settingsUpdatedAt="" holds={holds} audit={audit} admins={admins} pendingHoldCount={1} attention={attention} trend={trend} stats={{ available: 2, reserved: 2, drafts: 1, sold: 1, newRequests: 1 }} live stripeReady /></AdminLayout>;
}
