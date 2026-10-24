"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { PokemonSummary } from "./PokemonSummary";
import { useCatalog } from "../CatalogProvider";
import { catalogPokemon, pokemonImage as gen3Sprite, type PokemonTile as PokedexTile } from "../../lib/cms/pokemon";
import {
  availableCardCount,
  getTypeBadgeColor,
} from "../../lib/data";

const PREVIEW_CAP = 10;

export function PokedexSection() {
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

  const visible = filtered.slice(0, PREVIEW_CAP);
  const selected =
    visible.find((tile) => tile.id === selectedId) ??
    visible[0] ??
    POKEDEX_TILES[0];

  return (
    <section
      id="pokedex"
      data-pokedex-section="true"
      data-pokedex-preview="true"
      className="pokeball-cursor px-4 pb-10 md:px-8 md:pb-12"
    >
      <div className="rounded-[28px] border-[3px] border-ink-black bg-[#E94141] p-2 sm:p-3 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] md:p-5">
        {/* Pokédex device header: big blue light + 3 indicators */}
        <div className="mb-3 flex items-center gap-2 md:mb-4 md:gap-3">
          <div className="h-9 w-9 rounded-full border-[3px] border-ink-black bg-[#8DEBFF] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.75)] md:h-11 md:w-11" />
          <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-yellow" />
          <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-blue" />
          <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-pink" />
        </div>

        <div className="grid gap-2 sm:gap-3 md:gap-4 lg:grid-cols-[0.35fr_0.65fr]">
          {/* Left column: title, search, preview panel */}
          <aside className="space-y-3">
            <div className="rounded-[18px] border-[3px] border-ink-black bg-cream shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <div className="p-3 md:p-4">
                <h2 className="font-headline text-3xl font-bold leading-none text-ink-black md:text-5xl">
                  Pokédex
                </h2>
                <p className="mt-1 font-body text-xs text-ink-black/65 md:text-sm">
                  Search for a Pokémon by name or using its National Pokédex number.
                </p>
              </div>
              <div className="border-t-[3px] border-ink-black px-2.5 pb-2.5 md:px-3 md:pb-3">
                <label
                  htmlFor="pokedex-preview-search"
                  className="sr-only"
                >
                  Search
                </label>
                <div className="relative mt-2">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-black/45"
                    aria-hidden="true"
                  />
                  <input
                    id="pokedex-preview-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Name or number"
                    className="w-full rounded-[14px] border-2 border-ink-black bg-white py-2.5 pl-9 pr-3 font-body text-sm font-bold outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/20"
                  />
                </div>
              </div>
            </div>
            {visible.length > 0 && <PokemonSummary tile={selected} />}
          </aside>

          {/* Right column: dark screen with green grid of Pokémon tiles */}
          <div
            data-pokedex-grid="true"
            className="rounded-[22px] border-[3px] border-ink-black bg-[#242424] p-1.5 sm:p-2.5 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.08)] md:p-4"
          >
            <div
              data-pokedex-screen-overlay="true"
              className="gameboy-screen gameboy-screen--clear rounded-[16px] border-[3px] border-ink-black bg-[#0a120a] p-1.5 sm:p-2.5 md:p-3"
            >
              {visible.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {visible.map((tile) => (
                    <PokedexDeviceTile
                      key={tile.id}
                      tile={tile}
                      active={tile.id === selected.id}
                      onSelect={() => setSelectedId(tile.id)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  data-testid="pokedex-empty"
                  className="flex min-h-[200px] items-center justify-center text-center font-retro text-[10px] text-white/70"
                >
                  No Pokémon match &ldquo;{searchTerm}&rdquo;.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer link to the full Pokédex page */}
        <div className="mt-3 flex justify-center md:mt-4">
          <Link
            href="/pokedex"
            className="group inline-flex items-center gap-1.5 rounded-full border-2 border-ink-black bg-brand-yellow px-4 py-2 font-body text-xs font-bold text-ink-black shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] transition-all hover:-translate-y-0.5 hover:bg-white md:text-sm"
          >
            View full Pokédex
            <ChevronRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </section>
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
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      data-testid="pokedex-tile"
      className={`group relative min-w-0 rounded-[14px] border-2 bg-[#0a120a] p-1.5 sm:p-2 text-left shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition-colors ${
        active
          ? "border-brand-yellow"
          : "border-ink-black hover:border-brand-blue"
      }`}
    >
      <span
        data-pokedex-tile-number
        className="absolute left-1 top-1 font-retro text-[6px] text-white/60 sm:left-1.5 sm:text-[7px]"
      >
        # {String(tile.id).padStart(3, "0")}
      </span>
      <span className="absolute right-1 top-1 rounded-full bg-ink-black px-1 py-0.5 font-body text-[8px] font-bold text-white sm:right-1.5 sm:px-1.5 sm:text-[9px]">
        {availableCardCount(tile.id,cards)} {availableCardCount(tile.id,cards) === 1 ? "card" : "cards"} available
      </span>
      <div className="flex aspect-square items-center justify-center pt-3">
        <img
          src={gen3Sprite(tile.id)}
          alt={tile.name}
          width={80}
          height={80}
          className="pokedex-sprite h-full w-full object-contain [image-rendering:pixelated]"
        />
      </div>
      <h4
        data-pokedex-tile-name
        className="mt-1 font-body text-sm font-bold leading-tight text-white"
      >
        {tile.name}
      </h4>
      <div className="mt-1 flex flex-wrap gap-1">
        {tile.types.map((type) => (
          <span
            key={type}
            className={`rounded-full px-1.5 py-0.5 font-body text-[8px] font-bold uppercase ${getTypeBadgeColor(type)}`}
          >
            {type}
          </span>
        ))}
      </div>
    </button>
  );
}
