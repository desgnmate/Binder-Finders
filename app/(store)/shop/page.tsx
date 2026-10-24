import { getCatalog } from "../../../lib/cms/catalog";
import { CardDetailClient } from "../../../components/shop/CardDetailClient";


interface ShopPageProps {
  searchParams: Promise<{ q?: string; card?: string; type?: string; set?: string; pokemon?:string }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const {cards:SHOP_CARDS}=await getCatalog();
  const { q, card: cardId, type, set, pokemon } = await searchParams;

  // 1. Check if cardId is provided and completely invalid in global seed data.
  if (cardId) {
    const cardExists = SHOP_CARDS.some((c) => c.id === cardId);
    if (!cardExists) {
      return (
        <CardDetailClient
          card={null}
          filteredCards={[]}
          emptyState="card-not-found"
        />
      );
    }
  }

  let filtered = SHOP_CARDS;
  if(pokemon) filtered=filtered.filter(c=>c.pokemonId===Number(pokemon));

  if (q) {
    const query = q.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.set.toLowerCase().includes(query) ||
        c.type.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query),
    );
  }

  if (type && type.toLowerCase() !== "all") {
    const activeType = type.trim().toLowerCase();
    filtered = filtered.filter((c) => c.type.toLowerCase() === activeType);
  }

  if (set && set.toLowerCase() !== "all") {
    const activeSet = set.trim().toLowerCase();
    filtered = filtered.filter((c) => c.set.toLowerCase() === activeSet);
  }

  // 2. If filtered is empty, render the no-matches empty state.
  if (filtered.length === 0) {
    return (
      <CardDetailClient
        card={null}
        filteredCards={[]}
        emptyState="no-matches"
      />
    );
  }

  // Resolve the active card to display.
  const activeCard = cardId ? filtered.find((c) => c.id === cardId) ?? null : null;

  return <CardDetailClient card={activeCard} filteredCards={filtered} />;
}
