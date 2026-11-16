"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  availableCardCount,
  getTypeBadgeColor,
} from "../../lib/data";
import { SubpageHeader } from "../SubpageHeader";
import { RevealFooterLayout } from "../RevealFooterLayout";
import { SiteFooter } from "../footer/SiteFooter";
import { PokemonSummary } from "./PokemonSummary";
import { useCatalog } from "../CatalogProvider";
import { catalogPokemon, pokemonImage as gen3Sprite, type PokemonTile as PokedexTile } from "../../lib/cms/pokemon";


/** Tiles per page, so visitors don't scroll through hundreds of Pokémon. */
export const POKEDEX_PAGE_SIZE = 15;
const GENERATIONS = ["Gen I", "Gen II", "Gen III", "Gen IV"] as const;

/**
 * Page buttons to show: the first and last page and the ones around the
 * current page, with null for a gap ("…"). 33 pages fit on one line this way.
 */
export function pageList(current: number, count: number): (number | null)[] {
  const wanted = new Set([0, count - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) result.push(page - sorted[i - 1] === 2 ? page - 1 : null);
    result.push(page);
  });
  return result;
}

export function PokedexPageClient() {
  const {cards,settings}=useCatalog();
  const POKEDEX_TILES=useMemo(()=>catalogPokemon(cards,settings.pokedexIds),[cards,settings.pokedexIds]);
  const [searchTerm, setSearchTerm] = useState("");
  const [generation, setGeneration] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number>(POKEDEX_TILES[0].id);
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const qNum = q.replace(/^#?0*/, "");
    return POKEDEX_TILES.filter((tile) => {
      if (generation !== "all" && tile.details.generation !== generation) return false;
      if (!q) return true;
      if (tile.name.toLowerCase().includes(q)) return true;
      if (String(tile.id) === qNum) return true;
      if (String(tile.id).padStart(3, "0") === q) return true;
      return false;
    });
  }, [searchTerm,generation,POKEDEX_TILES]);

  // Only offer generations the store's Pokédex actually has.
  const generations = GENERATIONS.filter((gen) => POKEDEX_TILES.some((tile) => tile.details.generation === gen));
  const pageCount = Math.max(1, Math.ceil(filtered.length / POKEDEX_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageTiles = filtered.slice(currentPage * POKEDEX_PAGE_SIZE, (currentPage + 1) * POKEDEX_PAGE_SIZE);

  const selected =
    filtered.find((tile) => tile.id === selectedId) ??
    filtered[0] ??
    POKEDEX_TILES[0];

  function goToPage(next: number) {
    const target = Math.max(0, Math.min(next, pageCount - 1));
    setPage(target);
    // Show the first Pokémon of the new page in the detail screen.
    const first = filtered[target * POKEDEX_PAGE_SIZE];
    if (first) setSelectedId(first.id);
    // On phones the grid sits below the detail screen; keep it in view.
    const grid = gridRef.current;
    if (grid && grid.getBoundingClientRect().top < 0) {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      grid.scrollIntoView?.({ behavior: still ? "auto" : "smooth", block: "start" });
    }
  }

  return (
    <main data-pokedex-page data-pokedex-preview="true" className="pokeball-cursor relative min-h-screen bg-[#7b39ed] text-ink-black overflow-x-hidden">
      <RevealFooterLayout footer={<SiteFooter />}>
      <div className="min-h-screen bg-[#3194EE]">
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
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setPage(0);
                    }}
                    placeholder="Name or number"
                    className="w-full rounded-[14px] border-2 border-ink-black bg-cream py-2.5 pl-9 pr-3 font-body text-sm font-bold outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/20"
                  />
                </div>
                {generations.length > 1 && (
                  <div role="group" aria-label="Filter by generation" className="mt-3 flex flex-wrap gap-1.5">
                    {["all", ...generations].map((gen) => (
                      <button
                        key={gen}
                        type="button"
                        aria-pressed={generation === gen}
                        onClick={() => {
                          setGeneration(gen);
                          setPage(0);
                        }}
                        className="rounded-full border-2 border-ink-black bg-cream px-3 py-1.5 font-body text-xs font-bold text-ink-black hover:bg-pastel-yellow aria-pressed:bg-ink-black aria-pressed:text-brand-yellow"
                      >
                        {gen === "all" ? "All" : gen}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filtered.length > 0 && <>
                <PokemonSummary tile={selected} />
                <Link href={`/shop?pokemon=${selected.id}`} className="inline-flex w-full justify-center rounded-xl border-2 border-ink-black bg-brand-yellow px-4 py-3 text-sm font-bold text-ink-black hover:bg-white">
                  View cards in stock
                </Link>
              </>}
            </aside>

            <div ref={gridRef} className="scroll-mt-4 rounded-[22px] border-[3px] border-ink-black bg-[#242424] p-1.5 sm:p-2.5 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.08)] md:p-4">
              <div
                data-pokedex-screen-overlay="true"
                className="gameboy-screen gameboy-screen--clear rounded-[16px] border-[3px] border-ink-black bg-[#0a120a] p-1.5 sm:p-2.5 md:p-3"
              >
                {filtered.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {pageTiles.map((tile) => (
                        <PokedexDeviceTile
                          key={tile.id}
                          tile={tile}
                          active={tile.id === selected.id}
                          onSelect={() => setSelectedId(tile.id)}
                        />
                      ))}
                    </div>
                    {pageCount > 1 && (
                      <nav aria-label="Pokédex pages" className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-white/15 pt-3">
                        <button
                          type="button"
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 0}
                          className="rounded-full border-2 border-white/80 px-3 py-2 font-retro text-[9px] text-white hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-30 disabled:hover:border-white/80 disabled:hover:text-white"
                        >
                          ◀ Prev
                        </button>
                        <ol className="order-first flex w-full flex-wrap items-center justify-center gap-1.5 sm:order-none sm:w-auto">
                          {pageList(currentPage, pageCount).map((index, position) =>
                            index === null ? (
                              <li key={`gap-${position}`} aria-hidden="true" className="px-0.5 font-retro text-[9px] text-white/50">
                                …
                              </li>
                            ) : (
                            <li key={index}>
                              <button
                                type="button"
                                onClick={() => goToPage(index)}
                                aria-label={`Page ${index + 1}`}
                                aria-current={index === currentPage ? "page" : undefined}
                                className="h-8 min-w-8 rounded-lg border-2 border-white/30 px-1.5 font-retro text-[9px] text-white hover:border-brand-yellow aria-[current=page]:border-brand-yellow aria-[current=page]:bg-brand-yellow aria-[current=page]:text-ink-black"
                              >
                                {index + 1}
                              </button>
                            </li>
                            ),
                          )}
                        </ol>
                        <button
                          type="button"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage >= pageCount - 1}
                          className="rounded-full border-2 border-white/80 px-3 py-2 font-retro text-[9px] text-white hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-30 disabled:hover:border-white/80 disabled:hover:text-white"
                        >
                          Next ▶
                        </button>
                        <p className="w-full text-center font-retro text-[8px] text-white/60">
                          {currentPage * POKEDEX_PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * POKEDEX_PAGE_SIZE)} of {filtered.length}
                        </p>
                      </nav>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center text-center font-retro text-[11px] text-white/70">
                    {searchTerm.trim() ? <>No Pokémon match &ldquo;{searchTerm}&rdquo;.</> : "No Pokémon in this generation yet."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>
      </RevealFooterLayout>
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
          loading="lazy"
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
