"use client";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { AdminCardSummary, Collection } from "../../lib/cms/types";
import { SaveBar } from "./SaveBar";
import { slugify } from "./presentation";
import { useConfirm } from "./ConfirmDialog";

const pickerLimit = 100;

function CollectionEditor({
  collection,
  cards,
  busy,
  onSave,
  onClose,
}: {
  collection: Collection;
  cards: AdminCardSummary[];
  busy: boolean;
  onSave: (collection: Collection) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(collection);
  const [idTouched, setIdTouched] = useState(Boolean(collection.id));
  const [query, setQuery] = useState("");
  const confirm = useConfirm();
  const search = useDeferredValue(query).trim().toLowerCase();
  const isNew = !collection.updatedAt;
  const dirty = JSON.stringify(draft) !== JSON.stringify(collection);
  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const selected = new Set(draft.cardIds);
  const candidates = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.publication !== "archived" &&
          `${c.name} ${c.set} ${c.id}`.toLowerCase().includes(search),
      ),
    [cards, search],
  );
  async function close() {
    if (
      !dirty ||
      (await confirm({
        title: "Leave without saving?",
        body: `Your changes to ${draft.name || "this collection"} haven't been saved and will be lost.`,
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "danger",
        icon: "edit",
      }))
    )
      onClose();
  }
  function move(index: number, offset: number) {
    const next = [...draft.cardIds];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setDraft({ ...draft, cardIds: next });
  }
  function toggle(id: string, include: boolean) {
    setDraft({
      ...draft,
      cardIds: include
        ? [...draft.cardIds, id]
        : draft.cardIds.filter((cardId) => cardId !== id),
    });
  }

  return (
    <form
      className="cms-collection-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(draft)) onClose();
      }}
    >
      <div className="cms-editor-heading">
        <div>
          <nav className="cms-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <button type="button" onClick={() => void close()}>
                  Collections
                </button>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li aria-current="page">
                {isNew ? "New collection" : collection.name}
              </li>
            </ol>
          </nav>
          <h1>{isNew ? "New collection" : draft.name || "Edit collection"}</h1>
          <p>Choose which cards appear together, and in what order.</p>
        </div>
      </div>
      <fieldset disabled={busy}>
        <section className="cms-panel">
          <h2>Details</h2>
          <div className="cms-grid cms-grid-3">
            <label className="cms-field">
              Collection name
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    name: e.target.value,
                    id:
                      isNew && !idTouched
                        ? slugify(e.target.value, 80)
                        : draft.id,
                  })
                }
              />
            </label>
            <label className="cms-field">
              Collection ID
              <input
                required
                pattern="[a-z0-9][a-z0-9-]*"
                disabled={!isNew}
                value={draft.id}
                onChange={(e) => {
                  setIdTouched(true);
                  setDraft({ ...draft, id: e.target.value });
                }}
              />
              <small>
                {isNew
                  ? "Filled in from the name. Lowercase letters, numbers and dashes."
                  : "Fixed once created so existing links keep working."}
              </small>
            </label>
            <label className="cms-field">
              Display order
              <input
                type="number"
                min={0}
                max={9999}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: Number(e.target.value) })
                }
              />
              <small>Smaller numbers appear first.</small>
            </label>
          </div>
        </section>
        <div className="cms-collection-columns">
          <section className="cms-panel">
            <div className="cms-section-heading">
              <h2>In this collection</h2>
              <span className="cms-badge">{draft.cardIds.length}</span>
            </div>
            {draft.cardIds.length ? (
              <ol className="cms-ordered-cards">
                {draft.cardIds.map((id, i) => {
                  const card = cardById.get(id);
                  return (
                    <li key={id}>
                      <span className="cms-order-number">{i + 1}</span>
                      <div>
                        <strong>{card?.name || id}</strong>
                        <small>
                          {card ? `${card.set} · ${card.condition}` : id}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="cms-icon-btn"
                        disabled={i === 0}
                        aria-label={`Move ${id} up`}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="cms-icon-btn"
                        disabled={i === draft.cardIds.length - 1}
                        aria-label={`Move ${id} down`}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        className="cms-icon-btn"
                        aria-label={`Remove ${id}`}
                        onClick={() => toggle(id, false)}
                      >
                        <X size={15} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="cms-empty cms-empty-compact" data-variant="search">
                No cards yet. Pick cards from the list to add them here.
              </p>
            )}
          </section>
          <section className="cms-panel">
            <h2>Add cards</h2>
            <label className="cms-search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Search cards to add"
                placeholder="Search name, set or listing ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="cms-checklist">
              {candidates.slice(0, pickerLimit).map((c) => (
                <label className="cms-checkbox" key={c.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                  />
                  <span>
                    {c.name}
                    <small>
                      {c.set} · {c.condition}
                      {c.publication === "draft" ? " · Draft" : ""}
                    </small>
                  </span>
                </label>
              ))}
              {!candidates.length && (
                <p className="cms-muted">No cards match this search.</p>
              )}
            </div>
            {candidates.length > pickerLimit && (
              <small className="cms-muted">
                Showing {pickerLimit} of {candidates.length}. Search to narrow
                the list.
              </small>
            )}
          </section>
        </div>
      </fieldset>
      <SaveBar
        dirty={dirty}
        message={dirty ? "Unsaved changes" : "No changes yet"}
      >
        <button type="button" className="cms-btn" onClick={() => void close()}>
          Cancel
        </button>
        <button className="cms-btn cms-btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save collection"}
        </button>
      </SaveBar>
    </form>
  );
}

export function AdminCollections({
  collections,
  cards,
  selected,
  busy,
  onSelect,
  onSave,
}: {
  collections: Collection[];
  cards: AdminCardSummary[];
  selected: Collection | null;
  busy: boolean;
  onSelect: (collection: Collection | null) => void;
  onSave: (collection: Collection) => Promise<boolean>;
}) {
  const cardNameById = useMemo(
    () => new Map(cards.map((card) => [card.id, card.name])),
    [cards],
  );
  if (selected)
    return (
      <CollectionEditor
        key={selected.id || "new"}
        collection={selected}
        cards={cards}
        busy={busy}
        onSave={onSave}
        onClose={() => onSelect(null)}
      />
    );
  if (!collections.length)
    return (
      <section className="cms-panel cms-empty">
        <span className="cms-empty-icon">
          <BookOpen size={24} />
        </span>
        <h2>No collections yet</h2>
        <p>Group cards by set, era or theme so collectors can browse them.</p>
        <div className="cms-actions">
          <button
            className="cms-btn cms-btn-primary"
            onClick={() =>
              onSelect({ id: "", name: "", sortOrder: 0, cardIds: [] })
            }
          >
            <Plus size={16} /> New collection
          </button>
        </div>
      </section>
    );
  return (
    <div className="cms-collection-grid">
      {collections.map((c) => (
        <article className="cms-collection-card" key={c.id}>
          <div>
            <span className="cms-collection-order">Position {c.sortOrder}</span>
            <h2>{c.name}</h2>
            <p>
              {c.cardIds.length} {c.cardIds.length === 1 ? "card" : "cards"}
            </p>
            {c.cardIds.length > 0 && (
              <small>
                {c.cardIds
                  .slice(0, 3)
                  .map((id) => cardNameById.get(id) || id)
                  .join(", ")}
                {c.cardIds.length > 3 ? ` +${c.cardIds.length - 3} more` : ""}
              </small>
            )}
          </div>
          <button className="cms-btn" onClick={() => onSelect(c)}>
            Edit collection
          </button>
        </article>
      ))}
    </div>
  );
}
