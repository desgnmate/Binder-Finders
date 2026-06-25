"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SHOP_CARDS, type ShopCard } from "../../lib/data";

const STORAGE_KEY = "binderfinders:bag:v1";

interface BagContextValue {
  items: ShopCard[];
  cardIds: string[];
  count: number;
  total: number;
  addCard: (cardId: string) => void;
  removeCard: (cardId: string) => void;
  clearBag: () => void;
  hasCard: (cardId: string) => boolean;
}

export const BagContext = createContext<BagContextValue | null>(null);


export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used within a BagProvider");
  return ctx;
}

/**
 * BagProvider — local bag/cart state with localStorage persistence.
 *
 * Stores only card ids in localStorage; full card details are derived from
 * SHOP_CARDS so storage stays compact and consistent with the data layer.
 * Adding the same card twice does not create a duplicate row.
 */
export function BagProvider({ children }: { children: ReactNode }) {
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted ids on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter to valid card ids only.
          const valid = parsed.filter((id: unknown) =>
            SHOP_CARDS.some((c) => c.id === id),
          );
          // Deduplicate.
          setCardIds(Array.from(new Set(valid as string[])));
        }
      }
    } catch {
      // Corrupt storage — ignore.
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist on change — but only after the initial hydration so we don't
  // overwrite persisted state with the empty initial value.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cardIds));
    } catch {
      // Storage full or unavailable — ignore.
    }
  }, [cardIds, hydrated]);

  const items = cardIds
    .map((id) => SHOP_CARDS.find((c) => c.id === id))
    .filter((c): c is ShopCard => c !== undefined);

  const count = items.length;
  const total = items.reduce((sum, card) => sum + card.price, 0);

  const addCard = (cardId: string) => {
    setCardIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
  };

  const removeCard = (cardId: string) => {
    setCardIds((prev) => prev.filter((id) => id !== cardId));
  };

  const clearBag = () => {
    setCardIds([]);
  };

  const hasCard = (cardId: string) => cardIds.includes(cardId);

  return (
    <BagContext.Provider
      value={{ items, cardIds, count, total, addCard, removeCard, clearBag, hasCard }}
    >
      {children}
    </BagContext.Provider>
  );
}
