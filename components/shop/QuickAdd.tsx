"use client";

import { useContext } from "react";
import { BagContext } from "../bag/BagContext";
import { isCardAvailable, type ShopCard } from "../../lib/data";

export function QuickAdd({ card }: { card: ShopCard }) {
  const bag = useContext(BagContext);
  const inBag = bag?.hasCard(card.id) ?? false;
  const available = isCardAvailable(card);
  return (
    <button type="button" disabled={!bag || inBag || !available}
      aria-label={inBag ? `${card.name} is in your bag` : `Add ${card.name} to bag`}
      onClick={() => bag?.addCard(card.id)}
      className="mt-3 w-full rounded-xl border-2 border-ink-black bg-brand-yellow px-2 py-2.5 font-body text-xs font-bold text-ink-black transition-colors hover:bg-white disabled:cursor-default disabled:bg-white/15 disabled:text-white/70">
      {!available ? "Unavailable" : inBag ? "✓ In bag" : "+ Add to Bag"}
    </button>
  );
}
