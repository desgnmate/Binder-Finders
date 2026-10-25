"use client";
import { memo, useDeferredValue, useMemo, useState } from "react";
import { Layers, Search } from "lucide-react";
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

const CardsTable = memo(function CardsTable({
  cards,
  currency,
  onEdit,
}: {
  cards: CMSCard[];
  currency: string;
  onEdit: (card: CMSCard) => void;
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
      <table>
        <thead>
          <tr>
            <th>Card</th>
            <th>Condition</th>
            <th>Price {currency}</th>
            <th>Publication</th>
            <th>Availability</th>
            <th>
              <span className="cms-visually-hidden">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <div className="cms-card-cell">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span
                      className="cms-scan-placeholder"
                      aria-label="No scan uploaded"
                    >
                      <Layers size={18} />
                      <small>{card.number}</small>
                    </span>
                  )}
                  <div>
                    <button
                      type="button"
                      className="cms-row-link"
                      tabIndex={-1}
                      onClick={() => onEdit(card)}
                    >
                      {card.name}
                    </button>
                    <small>
                      {card.set} · {card.number}
                    </small>
                  </div>
                </div>
              </td>
              <td>{card.condition}</td>
              <td className="cms-money">{formatter.format(card.price)}</td>
              <td>
                <span className="cms-badge" data-status={card.publication}>
                  {card.publication}
                </span>
              </td>
              <td>
                <span className="cms-badge" data-status={card.availability}>
                  {card.availability === "reserved"
                    ? "On hold"
                    : card.availability}
                </span>
              </td>
              <td className="cms-row-action">
                <button
                  className="cms-btn"
                  onClick={() => onEdit(card)}
                  aria-label={`Edit ${card.name} ${card.id}`}
                >
                  Edit
                </button>
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
          className="cms-btn"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          className="cms-btn"
          disabled={page + 1 >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
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
  hidden,
  onEdit,
  onAdd,
}: {
  cards: CMSCard[];
  currency: string;
  initialFilter: string | null;
  hidden: boolean;
  onEdit: (card: CMSCard) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(() => filterFor(initialFilter)[0]);
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const normalizedQuery = useDeferredValue(query).trim().toLowerCase();
  const matches = filterFor(filter)[2];
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
    <section className="cms-panel cms-cards-panel" hidden={hidden}>
      <div className="cms-listing-tabs" aria-label="Listing status">
        {listingFilters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => chooseFilter(value)}
          >
            {label}
            <span>{counts[value]}</span>
          </button>
        ))}
      </div>
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
      </div>
      <CardsTable
        cards={visibleCards.slice(page * pageSize, (page + 1) * pageSize)}
        currency={currency}
        onEdit={onEdit}
      />
      {!visibleCards.length && (
        <div className="cms-empty">
          <Layers size={26} />
          <p>
            {cards.length
              ? "No listings match this search or status."
              : "No listings yet. Add your first card to start selling."}
          </p>
          <div className="cms-actions cms-empty-actions">
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
        <p className="cms-muted cms-table-footnote">
          {visibleCards.length}{" "}
          {visibleCards.length === 1 ? "listing" : "listings"}
          {cards.length === 1000 ? " · Showing the latest 1,000" : ""}
        </p>
      )}
    </section>
  );
}
