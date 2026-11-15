"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { StoreSettings } from "../../lib/cms/types";
import { DEFAULT_POKEDEX_IDS, gen3Pokemon, pokemonImage } from "../../lib/cms/pokemon";
import { FormSaveBar } from "./AdminStoreSettings";

const ALL = gen3Pokemon();
const ALL_IDS = ALL.map((p) => p.id);
const REGIONS = [
  ["all", "All", 1, 386],
  ["kanto", "Kanto", 1, 151],
  ["johto", "Johto", 152, 251],
  ["hoenn", "Hoenn", 252, 386],
] as const;

/** Choose which of the 386 Gen III Pokémon appear in the storefront Pokédex. */
export function AdminPokedex({
  draft,
  dirty,
  busy,
  cardPokemonIds,
  onChange,
  onDiscard,
  onSave,
}: {
  draft: StoreSettings;
  dirty: boolean;
  busy: boolean;
  /** Pokémon with a listed card always appear, whatever is chosen here. */
  cardPokemonIds: number[];
  onChange: (settings: StoreSettings) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof REGIONS)[number][0]>("all");
  const [show, setShow] = useState<"all" | "on" | "off">("all");
  const search = useDeferredValue(query).trim().toLowerCase().replace(/^#?0*/, "");
  const chosen = useMemo(() => new Set(draft.pokedexIds ?? DEFAULT_POKEDEX_IDS), [draft.pokedexIds]);
  const fromCards = useMemo(() => new Set(cardPokemonIds), [cardPokemonIds]);
  const [, , from, to] = REGIONS.find(([key]) => key === region)!;
  const visible = ALL.filter(
    (p) =>
      p.id >= from &&
      p.id <= to &&
      (show === "all" || (show === "on") === (chosen.has(p.id) || fromCards.has(p.id))) &&
      (!search || p.name.toLowerCase().includes(search) || String(p.id) === search),
  );
  const setChosen = (ids: Iterable<number>) =>
    onChange({ ...draft, pokedexIds: Array.from(new Set(ids)).sort((a, b) => a - b) });
  const toggle = (id: number) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };
  const visibleIds = visible.map((p) => p.id);
  const shownCount = new Set([...chosen, ...cardPokemonIds]).size;

  return (
    <form
      className="cms-settings"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <section className="cms-panel cms-stack" aria-labelledby="pokedex-picker-title">
        <div>
          <h2 id="pokedex-picker-title">Pokédex</h2>
          <p className="cms-muted">
            Tap a Pokémon to show or hide it in the storefront Pokédex. {shownCount} of {ALL.length} are shown.
            Pokémon with a listed card are always shown.
          </p>
        </div>
        <div className="cms-pokedex-tools">
          <label className="cms-search">
            <Search size={17} />
            <input
              type="search"
              aria-label="Search Pokémon"
              placeholder="Name or number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="cms-filter-pills" aria-label="Region">
            {REGIONS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={region === key} onClick={() => setRegion(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="cms-filter-pills" aria-label="Show">
            {(
              [
                ["all", "Everything"],
                ["on", "Shown"],
                ["off", "Hidden"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={show === key} onClick={() => setShow(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <fieldset disabled={busy} className="cms-pokedex-bulk">
          <button type="button" className="cms-btn" onClick={() => setChosen([...chosen, ...visibleIds])}>
            Show these {visibleIds.length}
          </button>
          <button
            type="button"
            className="cms-btn"
            onClick={() => setChosen([...chosen].filter((id) => !visibleIds.includes(id)))}
          >
            Hide these {visibleIds.length}
          </button>
          <button type="button" className="cms-btn" onClick={() => setChosen(ALL_IDS)}>
            Show all 386
          </button>
          <button type="button" className="cms-btn" onClick={() => setChosen(DEFAULT_POKEDEX_IDS)}>
            Reset to the original {DEFAULT_POKEDEX_IDS.length}
          </button>
        </fieldset>
        <fieldset disabled={busy} className="cms-pokedex-grid">
          <legend className="sr-only">Pokémon</legend>
          {visible.map((p) => {
            const locked = fromCards.has(p.id);
            const on = locked || chosen.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                disabled={locked}
                title={locked ? `${p.name} has a listed card, so it is always shown` : undefined}
                onClick={() => toggle(p.id)}
                className="cms-pokedex-tile"
              >
                {on && (
                  <span className="cms-pokedex-check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <img src={pokemonImage(p.id)} alt="" width={64} height={64} loading="lazy" />
                <small>#{String(p.id).padStart(3, "0")}</small>
                <strong>{p.name}</strong>
                {locked && <small>Has a card</small>}
              </button>
            );
          })}
          {!visible.length && <p className="cms-muted">No Pokémon match this search.</p>}
        </fieldset>
      </section>
      <FormSaveBar dirty={dirty} busy={busy} label="Save Pokédex" onDiscard={onDiscard} />
    </form>
  );
}
