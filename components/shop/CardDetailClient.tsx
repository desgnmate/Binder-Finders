"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft, Check, ShoppingBag, Trash2, Search, X } from "lucide-react";
import {
  formatPrice,
  shortCondition,
  getTypeBadgeColor,
  type ShopCard,
  SHOP_CARDS,
} from "../../lib/data";
import { useBag } from "../bag/BagContext";
import { RevealFooterLayout } from "../RevealFooterLayout";
import { SiteFooter } from "../footer/SiteFooter";
import { SubpageHeader } from "../SubpageHeader";


const MAX_TILT_DEG = 12;

/**
 * CardDetailClient — redesigned premium card detail view with search and filters.
 *
 * Renders the card image with 3D tilt and cursor-shine, a retro-brutalist
 * details layout, a physical slanted pricing label, and a bottom carousel
 * for seamless catalog browsing.
 */
export function CardDetailClient({
  card,
  filteredCards = SHOP_CARDS,
  emptyState = "no-matches",
}: {
  card: ShopCard | null;
  filteredCards?: ShopCard[];
  emptyState?: "card-not-found" | "no-matches";
}) {
  const { addCard, removeCard, hasCard } = useBag();
  const alreadyInBag = card ? hasCard(card.id) : false;
  const [added, setAdded] = useState(false);

  // 3D tilt state — auto-animated gentle figure-8, overridden by mouse hover
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const animRef = useRef(0);
  const startRef = useRef<number | null>(null);

  // Navigation hooks & filter state
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const qParam = searchParams.get("q") || "";
  const typeParam = searchParams.get("type") || "all";
  const setParam = searchParams.get("set") || "all";

  const [searchQuery, setSearchQuery] = useState(qParam);

  useEffect(() => {
    setSearchQuery(qParam);
  }, [qParam]);

  const updateParams = (
    newParams: { q?: string; type?: string; set?: string; card?: string },
    resetCard = false,
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newParams.q !== undefined) {
      if (newParams.q.trim()) {
        params.set("q", newParams.q);
      } else {
        params.delete("q");
      }
    }

    if (newParams.type !== undefined) {
      if (newParams.type && newParams.type !== "all") {
        params.set("type", newParams.type);
      } else {
        params.delete("type");
      }
    }

    if (newParams.set !== undefined) {
      if (newParams.set && newParams.set !== "all") {
        params.set("set", newParams.set);
      } else {
        params.delete("set");
      }
    }

    if (newParams.card !== undefined) {
      if (newParams.card) {
        params.set("card", newParams.card);
      } else {
        params.delete("card");
      }
    } else if (resetCard) {
      params.delete("card");
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: searchQuery }, true);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParams({ type: e.target.value }, true);
  };

  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParams({ set: e.target.value }, true);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    router.push(pathname);
  };

  // Get dynamic unique filters from the global dataset.
  const allTypes = Array.from(new Set(SHOP_CARDS.map((c) => c.type))).sort();
  const allSets = Array.from(new Set(SHOP_CARDS.map((c) => c.set))).sort();

  // Gentle auto-tilt on both axes (Lissajous figure-8). Resumes when mouse leaves.
  // CSS transition smooths the switch between auto and mouse-controlled tilt.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch { }

    const tick = (now?: number) => {
      const getSafeTime = () => {
        if (typeof performance !== "undefined" && typeof performance.now === "function") {
          const pNow = performance.now();
          if (typeof pNow === "number" && !isNaN(pNow)) return pNow;
        }
        return Date.now();
      };
      const timestamp = (typeof now === "number" && !isNaN(now)) ? now : getSafeTime();
      if (startRef.current === null) {
        startRef.current = timestamp;
      }
      const t = (timestamp - startRef.current) / 1000;
      if (!isHovered) {
        const amp = 4;
        const ax = amp * Math.sin(t * 0.7);
        const ay = amp * Math.cos(t * 0.5);
        setTilt({ x: ax, y: ay });
        // Shine follows the tilt — moves opposite to create parallax highlight
        setShinePos({ x: 50 - ay * 8, y: 50 + ax * 8 });
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -((cursorY - centerY) / centerY) * MAX_TILT_DEG;
    const rotateY = ((cursorX - centerX) / centerX) * MAX_TILT_DEG;
    setIsHovered(true);
    setTilt({ x: rotateX, y: rotateY });
    const baseX = 100 - (cursorX / rect.width) * 100;
    const baseY = 100 - (cursorY / rect.height) * 100;
    setShinePos({ x: baseX, y: baseY });
  };
  const handleMouseLeave = () => {
    setIsHovered(false);
  };
  const handleRemove = () => {
    if (!card) return;
    removeCard(card.id);
    setAdded(false);
  };

  const handleAdd = () => {
    if (!card || alreadyInBag || added) return;
    addCard(card.id);
    setAdded(true);
  };

  const isSpecialRare = card
    ? ["Ultra Rare", "Secret Rare", "Shining Holo"].includes(card.rarity)
    : false;

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
    setIsFlipping(true);
    setTimeout(() => setIsFlipping(false), 600);
  };

  const transform = `rotateY(${(tilt.y + (isFlipped ? 180 : 0)).toFixed(2)}deg) rotateX(${tilt.x.toFixed(2)}deg)`;
  const transition = isFlipping
    ? "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)"
    : isHovered
      ? "transform 150ms ease-out"
      : "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)";

  const shineBg = `radial-gradient(circle at ${shinePos.x.toFixed(1)}% ${shinePos.y.toFixed(1)}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.2) 35%, rgba(255, 255, 255, 0.08) 65%, transparent 90%)`;

  // Carousel other cards list
  const otherCards = filteredCards.filter((c) => c.id !== card?.id);

  return (
    <main className="pokeball-cursor relative min-h-screen bg-[#7b39ed] overflow-x-hidden">
      <RevealFooterLayout footer={<SiteFooter />}>

        <SubpageHeader title="Shop" />

        <section className="relative z-10 bg-[#fcf9ee] bg-[radial-gradient(#eae4d3_1px,transparent_1px)] [background-size:20px_20px]">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
            {/* Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="mb-6 flex items-center gap-2 font-body text-sm text-ink-black/60"
            >
              <Link href="/" className="hover:text-ink-black transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/shop" className="hover:text-ink-black transition-colors">
                Shop
              </Link>
              <span>/</span>
              <span className="font-semibold text-ink-black">
                {card ? card.name : "Search Results"}
              </span>
            </nav>

            {/* Search & Filter Controls */}
            <div className="w-full border-4 border-ink-black bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] sm:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] mb-6 sm:mb-8 z-20 relative">
              <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
                {/* Search query input */}
                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cards by name, set, type..."
                    className="w-full rounded-xl sm:rounded-2xl border-2 border-ink-black bg-cream px-3 py-2.5 sm:px-4 sm:py-3 font-body text-sm text-ink-black placeholder-ink-black/40 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        updateParams({ q: "" }, true);
                      }}
                      className="absolute right-12 text-ink-black/45 hover:text-ink-black p-1"
                      aria-label="Clear query"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="absolute right-2 rounded-xl bg-ink-black p-2 text-white hover:bg-brand-yellow hover:text-ink-black transition-colors"
                    aria-label="Submit search"
                  >
                    <Search size={16} />
                  </button>
                </div>

                {/* Filter selects and reset button */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* Type filter dropdown */}
                  <div className="flex-1 sm:flex-none">
                    <select
                      value={typeParam}
                      onChange={handleTypeChange}
                      className="w-full sm:w-40 rounded-xl sm:rounded-2xl border-2 border-ink-black bg-cream px-3 py-2.5 sm:px-4 sm:py-3 font-body text-sm text-ink-black shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231a1a1a%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[right_12px_center] bg-no-repeat pr-8"
                    >
                      <option value="all">All Types</option>
                      {allTypes.map((t) => (
                        <option key={t} value={t.toLowerCase()}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Set filter dropdown */}
                  <div className="flex-1 sm:flex-none">
                    <select
                      value={setParam}
                      onChange={handleSetChange}
                      className="w-full sm:w-44 rounded-xl sm:rounded-2xl border-2 border-ink-black bg-cream px-3 py-2.5 sm:px-4 sm:py-3 font-body text-sm text-ink-black shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231a1a1a%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[right_12px_center] bg-no-repeat pr-8"
                    >
                      <option value="all">All Sets</option>
                      {allSets.map((s) => (
                        <option key={s} value={s.toLowerCase()}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reset filters button */}
                  {(qParam || typeParam !== "all" || setParam !== "all") && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="rounded-xl sm:rounded-2xl border-2 border-ink-black bg-brand-pink text-ink-black font-body text-sm font-black px-4 py-2.5 sm:py-3 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0.5 transition-transform duration-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>

            {card === null ? (
              <div className="mx-auto max-w-xl text-center py-12 px-6 rounded-[24px] border-4 border-ink-black bg-white shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] my-12 relative z-10">
                <span className="text-6xl mb-4 block" role="img" aria-label="No results">
                  {emptyState === "card-not-found" ? "😢" : "🔍"}
                </span>
                <h2 className="font-body text-2xl font-black text-ink-black mb-2">
                  {emptyState === "card-not-found" ? "Card not found" : "No cards match"}
                </h2>
                <p className="font-body text-ink-black/60 mb-6">
                  {emptyState === "card-not-found"
                    ? "We couldn't find that card. It may have been sold or delisted."
                    : "No cards match your current search parameters. Try adjusting your query or resetting the filters!"}
                </p>
                <Link
                  href="/shop"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-ink-black bg-brand-yellow px-6 py-3 font-body text-sm font-black text-ink-black shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0.5 transition-transform duration-100"
                >
                  Browse all cards
                </Link>
              </div>
            ) : (
              /* Clean, Non-Binder Grid Layout */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Column: Clean borderless, backgroundless layout */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
                  {/* 3D Tilting Card Wrapper */}
                  <div
                    className="magnetic-card-wrapper mx-auto w-full max-w-[260px] xs:max-w-[320px] sm:max-w-[360px] md:max-w-[420px] focus:outline-none z-10 cursor-pointer"
                    onMouseMove={handleMouseMove}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleCardClick}
                  >
                    <div
                      data-magnetic-card-inner="true"
                      className="magnetic-card-inner relative select-none pointer-events-none rounded-[20px]"
                      style={{ transform, transition }}
                    >
                      {/* Front Face */}
                      <div className="magnetic-card-face magnetic-card-face--front">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-auto rounded-[20px] block"
                          referrerPolicy="no-referrer"
                        />
                        {/* Holographic Shine layer */}
                        <div
                          data-magnetic-card-shine="true"
                          className={`magnetic-card-shine rounded-[20px] ${isSpecialRare ? "animate-holographic" : ""}`}
                          style={{
                            background: shineBg,
                            opacity: 1,
                          }}
                          aria-hidden="true"
                        />
                      </div>

                      {/* Back Face */}
                      <div className="magnetic-card-face magnetic-card-face--back">
                        <img
                          src="/80680fbc635c78df8b860e0426ffe686.jpg"
                          alt="Pokémon TCG card back"
                          className="w-full h-auto rounded-[20px] block"
                          referrerPolicy="no-referrer"
                        />
                        {/* Glossy reflection shine layer for the back face */}
                        <div
                          data-magnetic-card-shine="true"
                          className="magnetic-card-shine rounded-[20px]"
                          style={{
                            background: shineBg,
                            opacity: 1,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Clean details panel */}
                <div className="lg:col-span-7 rounded-[24px] border-4 border-ink-black bg-brand-yellow p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col justify-between relative shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] sm:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] min-h-[300px] sm:min-h-[450px] lg:min-h-[500px]">
                  <div className="relative z-10 flex flex-col h-full justify-between gap-4 sm:gap-6">

                    {/* Header Badges & Price Row */}
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-lg border-2 border-ink-black px-3 py-1 font-retro text-[9px] uppercase tracking-wide font-black shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] ${getTypeBadgeColor(card.type)}`}
                          >
                            {card.type}
                          </span>
                          <span className="rounded-lg border-2 border-ink-black bg-cream px-3 py-1 font-retro text-[9px] uppercase tracking-wide font-black text-ink-black/60 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                            {card.set} · {card.year}
                          </span>
                        </div>

                        {/* Clean Horizontal Price Badge */}
                        <div
                          data-card-price="true"
                          className="rounded-xl border-2 border-ink-black bg-cream px-3 py-1 sm:px-4 sm:py-1.5 font-body text-xl sm:text-2xl font-black text-ink-black shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] sm:shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]"
                        >
                          {formatPrice(card.price)}
                        </div>
                      </div>

                      <div>
                        {/* Reduced name font size and switched to Fredoka font */}
                        <h1
                          data-card-name="true"
                          className="font-body text-2xl font-black leading-tight text-ink-black sm:text-3xl md:text-4xl lg:text-5xl"
                        >
                          {card.name}
                        </h1>
                        <p className="mt-1 font-retro text-[9px] uppercase tracking-widest text-ink-black/45 leading-none">
                          Card #{card.number}
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-[2px] bg-ink-black/10 my-1" />

                    {/* Description */}
                    <p className="font-body text-base leading-relaxed text-ink-black/85 md:text-lg max-w-2xl">
                      {card.description}
                    </p>

                    {/* Technical Specifications list */}
                    <dl className="grid grid-cols-3 gap-2 sm:gap-4 border-2 border-ink-black bg-cream p-2 sm:p-4 rounded-xl shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] sm:shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
                      <Spec label="Condition" value={card.condition} />
                      <Spec label="Rarity" value={card.rarity} />
                      <Spec label="Year" value={String(card.year)} />
                    </dl>

                    {/* Bag Action — no container, just buttons */}
                    <div className="flex justify-center mt-4">
                      {added || alreadyInBag ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <span
                            data-bag-confirmation="true"
                            className="inline-flex items-center gap-2 rounded-xl border-2 border-ink-black bg-[#ffd6e0] px-4 h-10 font-retro text-xs font-black text-ink-black uppercase tracking-wider leading-none select-none"
                          >
                            <Check size={14} className="stroke-[3]" aria-hidden="true" />
                            Added to bag
                          </span>
                          <Link
                            href="/checkout"
                            data-card-cta="true"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ink-black bg-ink-black px-5 h-10 font-body text-base font-black text-white hover:-translate-y-0.5 active:translate-y-[2px] transition-all duration-150"
                          >
                            <ShoppingBag size={14} aria-hidden="true" />
                            Go to checkout
                          </Link>
                          <button
                            type="button"
                            onClick={handleRemove}
                            className="inline-flex items-center justify-center rounded-xl border-2 border-ink-black bg-white w-10 h-10 text-ink-black hover:bg-red-50 hover:text-red-600 transition-colors"
                            aria-label="Remove from bag"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAdd}
                          data-card-cta="true"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink-black bg-cream px-6 py-3 font-body text-base font-black text-ink-black shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] transition-all duration-150 sm:w-auto"
                        >
                          <ShoppingBag size={16} aria-hidden="true" />
                          Add to Bag
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Other Cards — full-width dark binder-style section */}
        <section className="pokeball-cursor">
          <div
            className="-mt-16 border-y-2 border-white/20 bg-ink-black px-4 pt-8 pb-12 text-white shadow-[0_34px_120px_rgba(0,0,0,0.58),0_14px_40px_rgba(0,0,0,0.42)] md:-mt-20 md:px-8 md:pt-12 md:pb-16"
            style={{ borderRadius: "var(--radius-hero)" }}
          >
            <div className="mb-8">
              <h2 className="font-headline text-2xl font-bold text-white md:text-3xl">
                Other Cards in Stock
              </h2>
            </div>

            <div className="border-t border-white/10 pt-8">
              {otherCards.length > 0 ? (
                <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:gap-6">
                  {otherCards.map((item) => (
                    <div
                      key={item.id}
                      data-binder-source-cell="true"
                      className="rounded-[28px] border border-white/10 bg-white/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors hover:bg-white/[0.11] md:p-5"
                    >
                      <OtherCardGridItem card={item} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="font-body text-white/50 text-base">
                    No other cards found matching your search.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </RevealFooterLayout>
    </main>
  );
}

/**
 * OtherCardGridItem — grid card matching the BinderSection card style.
 * Magnetic tilt + shine on hover, links to the card detail page.
 */
function OtherCardGridItem({ card }: { card: ShopCard }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -((cursorY - centerY) / centerY) * MAX_TILT_DEG;
    const rotateY = ((cursorX - centerX) / centerX) * MAX_TILT_DEG;
    setTilt({ x: rotateX, y: rotateY });
    const baseX = 100 - (cursorX / rect.width) * 100;
    const baseY = 100 - (cursorY / rect.height) * 100;
    setShinePos({ x: baseX, y: baseY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const transform = `rotateY(${tilt.y.toFixed(2)}deg) rotateX(${tilt.x.toFixed(2)}deg)`;
  const shineBg = `radial-gradient(circle at ${shinePos.x.toFixed(1)}% ${shinePos.y.toFixed(1)}%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.18) 35%, rgba(255, 255, 255, 0.06) 65%, transparent 90%)`;

  return (
    <Link
      href={`/shop?card=${card.id}`}
      className="magnetic-card-wrapper relative block focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-yellow/50"
      aria-label={`${card.name} — ${shortCondition(card.condition)} · ${formatPrice(card.price)}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="magnetic-card-inner"
        style={{ transform }}
      >
        <div className="magnetic-card-face magnetic-card-face--front">
          <img
            src={card.imageUrl}
            alt={card.name}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <div
            className="magnetic-card-shine"
            style={{ background: shineBg }}
            aria-hidden="true"
          />
        </div>
      </div>
      <span className="pointer-events-none absolute bottom-2 left-2 z-30 flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-ink-black bg-brand-yellow text-center leading-none shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
        <span className="font-body text-[8px] font-bold uppercase text-ink-black">
          {shortCondition(card.condition)}
        </span>
        <span className="font-body text-[10px] font-bold text-ink-black">
          {formatPrice(card.price)}
        </span>
      </span>
    </Link>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-2 border-ink-black p-1.5 sm:p-3 bg-white rounded-lg sm:rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(26,26,26,1)] sm:shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] text-center relative overflow-hidden group/spec hover:-translate-y-0.5 transition-transform duration-200">
      <dt className="font-body text-[8px] sm:text-[9px] uppercase tracking-wider text-ink-black/45 leading-none">
        {label}
      </dt>
      <dd className="mt-1 font-body text-[10px] xs:text-xs sm:text-sm md:text-base font-black text-brand-blue leading-tight break-words uppercase">
        {value}
      </dd>
    </div>
  );
}
