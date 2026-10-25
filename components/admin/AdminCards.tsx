"use client";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Layers,
  MoreHorizontal,
  PencilLine,
  Search,
} from "lucide-react";
import type { CMSCard } from "../../lib/cms/types";
import { updateQuery } from "./presentation";

// "Available" matches the overview count: published and ready to request.
export const listingFilters = [
  ["all", "All", () => true],
  [
    "available",
    "Available",
    (c: CMSCard) =>
      c.publication === "published" && c.availability === "available",
  ],
  ["reserved", "On hold", (c: CMSCard) => c.availability === "reserved"],
  ["draft", "Drafts", (c: CMSCard) => c.publication === "draft"],
  ["sold", "Sold", (c: CMSCard) => c.availability === "sold"],
  ["archived", "Archived", (c: CMSCard) => c.publication === "archived"],
] as const;

function filterFor(value: string | null) {
  return listingFilters.find(([id]) => id === value) || listingFilters[0];
}

type RowActions = {
  onEdit: (card: CMSCard) => void;
  onDuplicate: (card: CMSCard) => void;
  onSetPublication: (
    card: CMSCard,
    publication: CMSCard["publication"],
  ) => void;
};

function RowMenu({
  card,
  busy,
  actions,
}: {
  card: CMSCard;
  busy: boolean;
  actions: RowActions;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointer = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const keydown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", pointer);
    window.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("mousedown", pointer);
      window.removeEventListener("keydown", keydown);
    };
  }, [open]);
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <div ref={root}>
      <button
        type="button"
        className="cms-round"
        data-tone="soft"
        aria-label={`More actions for ${card.name}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div
          className="cms-menu cms-row-menu"
          role="menu"
          aria-label={`${card.name} actions`}
        >
          <button
            type="button"
            role="menuitem"
            className="cms-menu-item"
            onClick={choose(() => actions.onEdit(card))}
          >
            <PencilLine size={17} />
            Edit listing
          </button>
          {card.publication !== "published" && card.imageUrl && (
            <button
              type="button"
              role="menuitem"
              className="cms-menu-item"
              disabled={busy}
              onClick={choose(() => actions.onSetPublication(card, "published"))}
            >
              <Check size={17} />
              Publish now
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="cms-menu-item"
            onClick={choose(() => actions.onDuplicate(card))}
          >
            <Copy size={17} />
            Duplicate as draft
          </button>
          {card.publication === "published" && (
            <a
              role="menuitem"
              className="cms-menu-item"
              href={`/shop?card=${encodeURIComponent(card.id)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <ExternalLink size={17} />
              View on storefront
            </a>
          )}
          {card.publication !== "archived" &&
            card.availability !== "reserved" && (
              <>
                <span className="cms-menu-sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="cms-menu-item"
                  data-tone="danger"
                  disabled={busy}
                  onClick={choose(() =>
                    actions.onSetPublication(card, "archived"),
                  )}
                >
                  <Archive size={17} />
                  Archive
                </button>
              </>
            )}
        </div>
      )}
    </div>
  );
}

const CardsTable = memo(function CardsTable({
  cards,
  currency,
  busy,
  actions,
}: {
  cards: CMSCard[];
  currency: string;
  busy: boolean;
  actions: RowActions;
}) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
      }),
    [],
  );

  return (
    <div className="cms-scroll">
      <table className="cms-table cms-cards-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Condition</th>
            <th>Price {currency}</th>
            <th>Publication</th>
            <th>Availability</th>
            <th>
              <span className="cms-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <div className="cms-card-cell">
                  <span className="cms-thumb" aria-hidden="true">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      card.number
                    )}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="cms-row-link"
                      tabIndex={-1}
                      onClick={() => actions.onEdit(card)}
                    >
                      {card.name}
                    </button>
                    <small>
                      {card.set} · {card.number}
                      {card.imageUrl ? "" : " · no scan yet"}
                    </small>
                  </div>
                </div>
              </td>
              <td data-label="Condition">
                <span className="cms-chip">{card.condition}</span>
              </td>
              <td data-label="Price" className="cms-money">
                {formatter.format(card.price)}
              </td>
              <td data-label="Publication">
                <span className="cms-badge" data-status={card.publication}>
                  {card.publication}
                </span>
              </td>
              <td data-label="Availability">
                <span className="cms-badge" data-status={card.availability}>
                  {card.availability === "reserved"
                    ? "On hold"
                    : card.availability}
                </span>
              </td>
              <td className="cms-row-action">
                <div>
                  <RowMenu card={card} busy={busy} actions={actions} />
                  <button
                    className="cms-round"
                    onClick={() => actions.onEdit(card)}
                    aria-label={`Edit ${card.name} ${card.id}`}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function PageControls({
  page,
  pageSize,
  total,
  label,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  label: string;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount < 2) return null;
  const first = page * pageSize + 1;
  const last = Math.min(first + pageSize - 1, total);
  return (
    <nav className="cms-pagination" aria-label={`${label} pages`}>
      <p aria-live="polite">
        Showing {first}–{last} of {total} {label}
      </p>
      <div>
        <button
          type="button"
          className="cms-round"
          data-tone="soft"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span aria-current="page">{page + 1}</span>
        <span>of {pageCount}</span>
        <button
          type="button"
          className="cms-round"
          aria-label="Next page"
          disabled={page + 1 >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

const pageSize = 40;

export function AdminCards({
  cards,
  currency,
  initialFilter,
  initialQuery = "",
  hidden,
  busy = false,
  onEdit,
  onAdd,
  onDuplicate = () => undefined,
  onSetPublication = () => undefined,
}: {
  cards: CMSCard[];
  currency: string;
  initialFilter: string | null;
  initialQuery?: string;
  hidden: boolean;
  busy?: boolean;
  onEdit: (card: CMSCard) => void;
  onAdd: () => void;
  onDuplicate?: RowActions["onDuplicate"];
  onSetPublication?: RowActions["onSetPublication"];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(() => filterFor(initialFilter)[0]);
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const normalizedQuery = useDeferredValue(query).trim().toLowerCase();
  const matches = filterFor(filter)[2];
  const actions = useMemo(
    () => ({ onEdit, onDuplicate, onSetPublication }),
    [onEdit, onDuplicate, onSetPublication],
  );
  const visibleCards = useMemo(
    () =>
      [...cards]
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "price-low"
              ? a.price - b.price
              : sort === "price-high"
                ? b.price - a.price
                : 0,
        )
        .filter(
          (c) =>
            matches(c) &&
            `${c.id} ${c.name} ${c.set} ${c.number}`
              .toLowerCase()
              .includes(normalizedQuery),
        ),
    [cards, matches, normalizedQuery, sort],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        listingFilters.map(([id, , test]) => [id, cards.filter(test).length]),
      ),
    [cards],
  );
  function chooseFilter(value: string) {
    setPage(0);
    setFilter(value as typeof filter);
    updateQuery({ filter: value === "all" ? null : value });
  }

  return (
    <section aria-label="Listings" hidden={hidden}>
      <div className="cms-tabs" aria-label="Listing status">
        {listingFilters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="cms-tab"
            aria-pressed={filter === value}
            onClick={() => chooseFilter(value)}
          >
            {label}
            <span>{counts[value]}</span>
          </button>
        ))}
      </div>
      <div className="cms-panel cms-tabbed cms-cards-panel">
        <div className="cms-toolbar">
          <label className="cms-search">
            <Search size={17} />
            <input
              aria-label="Search cards"
              type="search"
              placeholder="Search name, set, number or listing ID…"
              value={query}
              onChange={(e) => {
                setPage(0);
                setQuery(e.target.value);
              }}
            />
          </label>
          <label className="cms-sort">
            Sort
            <select
              aria-label="Sort listings"
              value={sort}
              onChange={(e) => {
                setPage(0);
                setSort(e.target.value);
              }}
            >
              <option value="recent">Newest listings</option>
              <option value="name">Name A–Z</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>
        {visibleCards.length > 0 ? (
          <CardsTable
            cards={visibleCards.slice(page * pageSize, (page + 1) * pageSize)}
            currency={currency}
            busy={busy}
            actions={actions}
          />
        ) : (
          <div
            className="cms-empty"
            data-variant={cards.length ? "search" : undefined}
          >
            <span className="cms-empty-icon">
              {cards.length ? <Search size={24} /> : <Layers size={24} />}
            </span>
            <strong>
              {cards.length
                ? query
                  ? `No listings match “${query}”`
                  : "No listings with this status"
                : "No listings yet"}
            </strong>
            <span>
              {cards.length
                ? "Try another name or set, or clear the filters."
                : "Add your first card to start selling."}
            </span>
            <div className="cms-actions">
              {(query || filter !== "all") && (
                <button
                  type="button"
                  className="cms-btn"
                  onClick={() => {
                    setQuery("");
                    chooseFilter("all");
                  }}
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                className="cms-btn cms-btn-primary"
                onClick={onAdd}
              >
                Add card
              </button>
            </div>
          </div>
        )}
        <PageControls
          page={page}
          pageSize={pageSize}
          total={visibleCards.length}
          label="listings"
          onChange={setPage}
        />
        {visibleCards.length > 0 && visibleCards.length <= pageSize && (
          <p className="cms-table-footnote">
            {visibleCards.length}{" "}
            {visibleCards.length === 1 ? "listing" : "listings"}
            {cards.length === 1000 ? " · Showing the latest 1,000" : ""}
          </p>
        )}
      </div>
    </section>
  );
}
