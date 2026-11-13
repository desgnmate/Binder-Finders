"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useBag } from "../bag/BagContext";
import { isCardAvailable, type ShopCard } from "../../lib/data";
import { btnDark, btnWhite } from "./ui";

type Scan = { src: string; label: string };

/** Scan viewer with front/back/extra thumbnails. */
export function CardScans({ card, faceColor }: { card: ShopCard & { additionalImages?: string[] }; faceColor: string }) {
  const scans: Scan[] = [
    card.imageUrl && { src: card.imageUrl, label: "Front scan" },
    card.backImageUrl && { src: card.backImageUrl, label: "Back scan" },
    ...(card.additionalImages || []).map((src, i) => ({ src, label: `Extra photo ${i + 1}` })),
  ].filter(Boolean) as Scan[];
  const [active, setActive] = useState(0);
  const current = scans[active];

  return (
    <section aria-label="Card scans" className="flex min-w-0 flex-[1_1_480px] flex-col gap-4">
      <div className="flex justify-center rounded-[28px] border-[3px] border-ink-black bg-ink-black p-6 shadow-[6px_6px_0_#1a1a1a] md:p-8">
        {current ? (
          <img
            src={current.src}
            alt={`${card.name} – ${current.label.toLowerCase()}`}
            referrerPolicy="no-referrer"
            className="aspect-[63/88] w-full max-w-[360px] rounded-[14px] object-contain"
          />
        ) : (
          <div
            className="flex aspect-[63/88] w-full max-w-[300px] items-center justify-center rounded-[14px] border-[3px] border-white"
            style={{ background: faceColor }}
          >
            <img src={`/sprites/gen3/${card.pokemonId}.png`} alt="" className="w-[62%] [image-rendering:pixelated]" />
          </div>
        )}
      </div>
      {scans.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          {scans.map((scan, i) => (
            <button
              key={scan.src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={scan.label}
              aria-pressed={i === active}
              className="aspect-[63/88] w-[72px] overflow-hidden rounded-[10px] border-[3px] border-ink-black bg-white p-0 aria-pressed:shadow-[3px_3px_0_#fedd25] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-brand-blue"
            >
              <img src={scan.src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="m-0 text-sm text-ink-black/75">Photos are flatbed scans of this exact card. What you see is what you get.</p>
    </section>
  );
}

/** Add to bag / ask buttons, aware of stock and what's already in the bag. */
export function CardActions({ card }: { card: ShopCard }) {
  const { hydrated, addCard, hasCard } = useBag();
  const inBag = hydrated && hasCard(card.id);
  const available = isCardAvailable(card);
  const ask = `/contact?topic=card&card=${encodeURIComponent(card.id)}`;

  return (
    <div className="flex flex-wrap gap-2.5">
      {!available ? (
        <span className={`${btnWhite} min-h-[52px] flex-[1_1_200px] !cursor-default !shadow-none opacity-70`}>
          {card.availability === "sold" ? "Sold" : card.availability === "reserved" ? "On hold" : "Unavailable"}
        </span>
      ) : inBag ? (
        <Link href="/checkout" className={`${btnDark} min-h-[52px] flex-[1_1_200px] text-[17px]`}>
          <Check size={18} aria-hidden="true" />
          In your bag — view bag
        </Link>
      ) : (
        <button type="button" onClick={() => addCard(card.id)} className={`${btnDark} min-h-[52px] flex-[1_1_200px] text-[17px]`}>
          <ShoppingBag size={18} aria-hidden="true" />
          Add to bag
        </button>
      )}
      <Link href={ask} className={`${btnWhite} min-h-[52px] flex-[1_1_160px]`}>
        Ask about this card
      </Link>
    </div>
  );
}
