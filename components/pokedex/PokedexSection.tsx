"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, ChevronRight } from "lucide-react";
import {
  POKEDEX_TILES,
  gen3Sprite,
  formatPrice,
  getTypeBadgeColor,
  shortCondition,
  type PokedexTile,
} from "../../lib/data";

const PREVIEW_CAP = 10;

export function PokedexSection() {
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
            {selected && <PreviewPanel tile={selected} />}
          </aside>

          {/* Right column: dark screen with green grid of Pokémon tiles */}
          <div
            data-pokedex-grid="true"
            className="rounded-[22px] border-[3px] border-ink-black bg-[#242424] p-1.5 sm:p-2.5 shadow-[inset_0_0_0_3px_rgba(255,255,255,0.08)] md:p-4"
          >
            <div
              data-pokedex-screen-overlay="true"
              className="gameboy-screen rounded-[16px] border-[3px] border-ink-black bg-[#0a120a] p-1.5 sm:p-2.5 md:p-3"
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
                  className="flex min-h-[200px] items-center justify-center text-center font-retro text-[10px] text-ink-black/55"
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

function PreviewPanel({ tile }: { tile: PokedexTile }) {
  const d = tile.details;
  return (
    <div
      data-pokedex-preview-panel="true"
      className="rounded-[18px] border-[3px] border-ink-black bg-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
    >
      <div className="grid grid-cols-[0.45fr_0.55fr] gap-3 p-3 pb-4">
        <div className="flex aspect-square items-center justify-center rounded-[16px] border-[3px] border-ink-black bg-cream p-2">
          <img
            src={gen3Sprite(tile.id)}
            alt={tile.name}
            width={160}
            height={160}
            className="h-full w-full object-contain [image-rendering:pixelated]"
          />
        </div>

        <div className="flex flex-col pt-2">
          <h3 className="font-headline text-3xl font-bold leading-none text-ink-black md:text-4xl">
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
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      data-testid="pokedex-tile"
      className={`group relative rounded-[14px] border-2 bg-[#0a120a] p-1.5 sm:p-2 text-left shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition-colors ${
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
        {shortCondition(tile.startingCondition)} · {formatPrice(tile.startingPrice)}
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
