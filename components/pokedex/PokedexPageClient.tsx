"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  availableCardCount,
  getTypeBadgeColor,
} from "../../lib/data";
import { SubpageHeader } from "../SubpageHeader";
import { PokemonSummary } from "./PokemonSummary";
import { useCatalog } from "../CatalogProvider";
import { catalogPokemon, pokemonImage as gen3Sprite, type PokemonTile as PokedexTile } from "../../lib/cms/pokemon";


export function PokedexPageClient() {
  const {cards}=useCatalog();
  const POKEDEX_TILES=useMemo(()=>catalogPokemon(cards),[cards]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number>(POKEDEX_TILES[0].id);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return POKEDEX_TILES;
    const qNum = q.replace(/^#?0*/, "");
    return POKEDEX_TILES.filter((tile) => {
      if (tile.name.toLowerCase().includes(q)) return true;
      if (String(tile.id) === qNum) return true;
      if (String(tile.id).padStart(3, "0") === q) return true;
      return false;
    });
  }, [searchTerm,POKEDEX_TILES]);

  const selected =
    filtered.find((tile) => tile.id === selectedId) ??
    filtered[0] ??
    POKEDEX_TILES[0];

  return (
    <main data-pokedex-page data-pokedex-preview="true" className="pokeball-cursor min-h-screen bg-[#3194EE] text-ink-black overflow-x-hidden">
      <SubpageHeader title="Dedicated Pokédex" />


      <section className="px-4 pt-6 pb-10 md:px-8 md:pt-8 md:pb-16">
        <div className="rounded-[28px] border-[3px] border-ink-black bg-[#E94141] p-2 sm:p-3 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] md:p-5">
          <div className="mb-3 flex items-center gap-2 md:mb-4 md:gap-3">
            <div className="h-9 w-9 rounded-full border-[3px] border-ink-black bg-[#8DEBFF] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.75)] md:h-11 md:w-11" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-yellow" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-blue" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-pink" />
          </div>

          <div className="grid gap-2 sm:gap-3 md:gap-4 lg:grid-cols-[0.35fr_0.65fr]">
            <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-[18px] border-[3px] border-ink-black bg-cream p-3 md:p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                <h1 className="font-headline text-3xl font-bold leading-none text-ink-black md:text-5xl">
                  Pokédex
                </h1>
                <p className="mt-2 font-body text-xs text-ink-black/65 md:text-sm">
                  Hover a Pokémon to update the detail screen. Tap a tile to
                  view cards in stock for that character.
                </p>
              </div>

              <div className="rounded-[18px] border-[3px] border-ink-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                <label htmlFor="pokedex-page-search" className="sr-only">
                  Search
                </label>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-black/45" aria-hidden="true" />
                  <input
                    id="pokedex-page-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Name or number"
                    className="w-full rounded-[14px] border-2 border-ink-black bg-cream py-2.5 pl-9 pr-3 font-body text-sm font-bold outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/20"
                  />
                </div>
              </div>

              {filtered.length > 0 && <>
                <PokemonSummary tile={selected} />
                <Link href={`/shop?pokemon=${selected.id}`} className="inline-flex w-full justify-center rounded-xl border-2 border-ink-black bg-brand-yellow px-4 py-3 text-sm font-bold text-ink-black hover:bg-white">
                  View cards in stock
                </Link>
              </>}
            </aside>

            <div className="rounded-[22px] border-[3px] border-ink-black bg-[#242424] p-1.5 sm:p-2.5 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.08)] md:p-4">
              <div
                data-pokedex-screen-overlay="true"
                className="gameboy-screen gameboy-screen--clear rounded-[16px] border-[3px] border-ink-black bg-[#0a120a] p-1.5 sm:p-2.5 md:p-3"
              >
                {filtered.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((tile) => (
                      <PokedexDeviceTile
                        key={tile.id}
                        tile={tile}
                        active={tile.id === selected.id}
                        onSelect={() => setSelectedId(tile.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center text-center font-retro text-[11px] text-white/70">
                    No Pokémon match &ldquo;{searchTerm}&rdquo;.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


function PokedexDeviceTile({
  tile,
  active,
  onSelect,
}: {
  tile: PokedexTile;
  active: boolean;
  onSelect: () => void;
}) {
  const {cards}=useCatalog();
  return (
    <Link
      href={`/shop?pokemon=${tile.id}`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={`group relative min-w-0 rounded-[18px] border-2 bg-[#0a120a] p-2 sm:p-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] transition-colors ${
        active ? "border-brand-yellow" : "border-ink-black hover:border-brand-blue"
      }`}
    >
      <span className="block font-retro text-[6px] text-white/60 sm:text-[8px]">
        # {String(tile.id).padStart(3, "0")}
      </span>
      <span className="mt-1 inline-block rounded-full bg-ink-black px-1.5 py-0.5 font-body text-[8px] font-bold text-white sm:px-2 sm:py-1 sm:text-[10px]">
        {availableCardCount(tile.id,cards)} {availableCardCount(tile.id,cards) === 1 ? "card" : "cards"} available
      </span>
      <div className="flex aspect-square items-center justify-center pt-5">
        <img
          src={gen3Sprite(tile.id)}
          alt={tile.name}
          width={120}
          height={120}
          className="pokedex-sprite h-full w-full object-contain [image-rendering:pixelated]"
        />
      </div>
      <h3 className="mt-2 break-words font-body text-sm font-bold leading-tight text-white">
        {tile.name}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1">
        {tile.types.map((type) => (
          <span key={type} className={`rounded-full px-2 py-0.5 font-body text-[10px] font-bold uppercase ${getTypeBadgeColor(type)}`}>
            {type}
          </span>
        ))}
      </div>
    </Link>
  );
}
