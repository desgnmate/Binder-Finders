import { getCatalog } from "../../../lib/cms/catalog";
import type { Metadata } from "next";
import { CardDetailClient } from "../../../components/shop/CardDetailClient";
import { cardMetadata, pageMetadata } from "../../../lib/seo";


interface ShopPageProps {
  searchParams: Promise<{ q?: string; card?: string; type?: string; set?: string; pokemon?:string }>;
}

const SHOP_DESCRIPTION =
  "Shop vintage Pokémon cards, graded and raw. Every listing shows real flatbed scans of the actual card, front and back.";

export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const { cards, settings } = await getCatalog();
  const { card: cardId } = await searchParams;
  if (cardId) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return { title: "Card not found", robots: { index: false, follow: true } };
    return cardMetadata(card, settings?.currency);
  }
  // Searches and filters are views of the same shop, so they all point to it.
  return pageMetadata({ title: "Shop vintage Pokémon cards", description: SHOP_DESCRIPTION, path: "/shop" });
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
