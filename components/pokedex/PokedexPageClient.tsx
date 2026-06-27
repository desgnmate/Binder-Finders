"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import {
  POKEDEX_TILES,
  SHOP_CARDS,
  formatPrice,
  gen3Sprite,
  getTypeBadgeColor,
  shortCondition,
  type PokedexTile,
} from "../../lib/data";
import { SubpageHeader } from "../SubpageHeader";


export function PokedexPageClient() {
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
  }, [searchTerm]);

  const selected =
    filtered.find((tile) => tile.id === selectedId) ??
    filtered[0] ??
    POKEDEX_TILES[0];

  return (
    <main className="pokeball-cursor min-h-screen bg-[#3194EE] text-ink-black overflow-x-hidden">
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

              <PreviewPanel tile={selected} />
            </aside>

            <div className="rounded-[22px] border-[3px] border-ink-black bg-[#242424] p-1.5 sm:p-2.5 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.08)] md:p-4">
              <div
                data-pokedex-screen-overlay="true"
                className="gameboy-screen rounded-[16px] border-[3px] border-ink-black bg-[#0a120a] p-1.5 sm:p-2.5 md:p-3"
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
                  <div className="flex min-h-[320px] items-center justify-center text-center font-retro text-[11px] text-ink-black/55">
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

function PreviewPanel({ tile }: { tile: PokedexTile }) {
  const d = tile.details;

  return (
    <div
      data-pokedex-preview-panel="true"
      className="rounded-[18px] border-[3px] border-ink-black bg-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
    >
      <div className="grid grid-cols-[90px_1fr] sm:grid-cols-[0.45fr_0.55fr] gap-3 p-2 sm:p-3 pb-4">
        <div className="flex aspect-square items-center justify-center rounded-[16px] border-[3px] border-ink-black bg-cream p-2">
          <img
            src={gen3Sprite(tile.id)}
            alt={tile.name}
            width={160}
            height={160}
            className="h-full w-full object-contain [image-rendering:pixelated]"
          />
        </div>

        <div className="flex flex-col pt-2 min-w-0">
          <h3 className="font-headline text-2xl sm:text-3xl font-bold leading-none text-ink-black md:text-4xl">
            {tile.name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {tile.types.map((type) => (
              <span
                key={type}
                className={`rounded-full px-2.5 py-0.5 font-body text-[10px] font-bold uppercase md:text-[11px] ${getTypeBadgeColor(type)}`}
              >
                {type}
              </span>
            ))}
          </div>
          <p className="mt-2 font-body text-[13px] italic leading-tight text-ink-black/55 md:text-[14px]">
            {d.category}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 font-body text-[13px] text-ink-black md:text-[14px]">
            <dt className="text-ink-black/55">HT</dt>
            <dd className="font-bold">{d.height}</dd>
            <dt className="text-ink-black/55">WT</dt>
            <dd className="font-bold">{d.weight}</dd>
            <dt className="text-ink-black/55">ABL</dt>
            <dd className="font-bold">{d.ability}</dd>
            <dt className="text-ink-black/55">GEN</dt>
            <dd className="font-bold">{d.generation}</dd>
          </dl>
        </div>
      </div>
      <div className="border-t-[3px] border-ink-black px-3.5 py-3 bg-[#FCFBF8] rounded-b-[15px]">
        <div className="flex justify-between items-center mb-2.5">
          <h4 className="font-body text-base font-bold text-ink-black/75">
            Base Stats
          </h4>
          <span className="font-body text-sm font-bold text-ink-black/60">
            BST {d.baseStatTotal}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <StatBar label="HP" value={d.hp} max={255} color="#FF6B6B" />
          <StatBar label="SPA" value={d.spAtk} max={255} color="#3194EE" />
          <StatBar label="ATK" value={d.attack} max={255} color="#F0932B" />
          <StatBar label="SPD" value={d.spDef} max={255} color="#10B981" />
          <StatBar label="DEF" value={d.defense} max={255} color="#EAB308" />
          <StatBar label="SPE" value={d.speed} max={255} color="#a754f6" />
        </div>
        <Link
          href={`/shop?q=${encodeURIComponent(tile.name)}`}
          className="mt-3.5 inline-flex w-full justify-center rounded-[12px] border-2 border-ink-black bg-brand-yellow px-4 py-2 font-retro text-[10px] text-ink-black shadow-[3px_3px_0_rgba(26,26,26,1)] hover:bg-white active:scale-95 transition-all"
        >
          View cards in stock
        </Link>
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2 w-full font-body text-xs">
      <span className="w-8 font-retro text-[10px] font-bold text-ink-black/50">
        {label}
      </span>
      <span className="w-6 text-right font-body text-sm font-black text-ink-black">
        {value}
      </span>
      <div className="flex-1 h-2.5 rounded-full border border-ink-black bg-[#EAEAEA] overflow-hidden shadow-[inset_1px_1px_0px_0px_rgba(0,0,0,0.1)]">
        <div 
          className="h-full rounded-full transition-all duration-300" 
          style={{ width: `${pct}%`, backgroundColor: color }} 
        />
      </div>
    </div>
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
  return (
    <Link
      href={`/shop?q=${encodeURIComponent(tile.name)}`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={`group relative min-w-0 rounded-[18px] border-2 bg-[#0a120a] p-2 sm:p-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] transition-colors ${
        active ? "border-brand-yellow" : "border-ink-black hover:border-brand-blue"
      }`}
    >
      <span className="absolute left-1 top-1 font-retro text-[6px] text-white/60 sm:left-2 sm:top-2 sm:text-[8px]">
        # {String(tile.id).padStart(3, "0")}
      </span>
      <span className="absolute right-1 top-1 rounded-full bg-ink-black px-1.5 py-0.5 font-body text-[8px] font-bold text-white sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px]">
        {shortCondition(tile.startingCondition)} · {formatPrice(tile.startingPrice)}
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
      <h3 className="mt-2 font-body text-base font-bold leading-tight text-white">
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
