"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { X, Calendar, Hash, Shield, Flame, Sparkles, Eye } from "lucide-react";
import {
  BINDER_TABS,
  formatPrice,
  shortCondition,
  getTypeBadgeColor,
  type ShopCard,
} from "../../lib/data";

const MAX_TILT_DEG = 14;
const FOCUS_OPEN_MS = 600;
const FOCUS_CLOSE_MS = 300;
const CARD_BACK_IMAGE_SRC = "/80680fbc635c78df8b860e0426ffe686.jpg";
// Focused card matches the source grid cell size at any screen width.

type FocusStage = "opening" | "open" | "closing";
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * BinderSection — full-width vault showcase.
 *
 * Clicking a grid card captures its source rect, swaps the source cell
 * with a placeholder, and animates a centered focus card to the viewport
 * center. The focused card ALWAYS shows the real Pokémon TCG card back
 * image (no front face, no 3D rotation, no cross-fade) — the user
 * explicitly asked to see the actual back image, not a mirrored front.
 * The "flip" is implied by the card scaling up from the source grid cell
 * to the center. A right-side details panel shows the card info and a
 * "View shop listing" CTA. Click-outside, Esc, or the CTA navigates.
 */
export function BinderSection() {
  const [activeTabId, setActiveTabId] = useState<string>(BINDER_TABS[0].id);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [focusStage, setFocusStage] = useState<FocusStage | null>(null);
  const sourceRectRef = useRef<{ rect: DOMRect; cell: HTMLElement } | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const activeTab =
    BINDER_TABS.find((t) => t.id === activeTabId) ?? BINDER_TABS[0];
  const cardCount = Math.min(activeTab.cards.length, 12);

  const focusedCard = useMemo(
    () => (focusedCardId
      ? BINDER_TABS.flatMap((t) => t.cards).find((c) => c.id === focusedCardId) ?? null
      : null),
    [focusedCardId],
  );

  const closeFocusedCard = useCallback(() => {
    setFocusStage("closing");
  }, []);

  const handleFocus = useCallback((card: ShopCard, sourceCell: HTMLElement) => {
    // Capture the source rect BEFORE setting state so it reflects the
    // un-placeholder'd layout.
    sourceRectRef.current = {
      rect: sourceCell.getBoundingClientRect(),
      cell: sourceCell,
    };
    setFocusedCardId(card.id);
    setFocusStage("opening");
  }, []);

  // Open lifecycle: FOCUS_OPEN_MS then transition to "open".
  useEffect(() => {
    if (focusStage !== "opening") {
      return;
    }
    if (prefersReducedMotion()) {
      setFocusStage("open");
      return;
    }
    const openTimer = window.setTimeout(() => {
      setFocusStage("open");
    }, FOCUS_OPEN_MS);
    return () => window.clearTimeout(openTimer);
  }, [focusStage]);

  // Close lifecycle: FOCUS_CLOSE_MS then unmount.
  useEffect(() => {
    if (focusStage !== "closing") {
      return;
    }
    const closeTimer = window.setTimeout(() => {
      setFocusedCardId(null);
      setFocusStage(null);
      sourceRectRef.current = null;
    }, FOCUS_CLOSE_MS);
    closeTimerRef.current = closeTimer;
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [focusStage]);

  return (
    <section
      id="binder"
      data-binder-section="true"
      className="pokeball-cursor py-0"
    >
      <div
        className="w-full border-y-2 border-white/20 bg-ink-black px-4 pt-8 pb-12 text-white shadow-[0_34px_120px_rgba(0,0,0,0.58),0_14px_40px_rgba(0,0,0,0.42)] md:px-8 md:pt-12 md:pb-16"
        style={{ borderRadius: "var(--radius-hero)" }}
      >
        {/* Full-width header and controls */}
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] lg:items-end">
          <div>
            <h2 className="font-headline text-3xl font-bold text-white sm:text-4xl md:text-6xl">
              The Binder
            </h2>
            <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-white/55 md:text-lg">
              Click a card to bring its full TCG art into focus. Click anywhere outside to send it back.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="font-retro text-[8px] uppercase tracking-widest text-white/35">
                Select era
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 font-body text-xs font-bold text-white/70">
                {cardCount} {cardCount === 1 ? "card" : "cards"}
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Binder eras"
              className="grid gap-2 sm:grid-cols-3"
            >
              {BINDER_TABS.map((tab) => {
                const active = tab.id === activeTabId;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    data-binder-tab={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`rounded-2xl border px-4 py-3 text-left font-body text-sm font-bold transition-all duration-200 ${active
                      ? "border-brand-yellow bg-brand-yellow text-ink-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.22)]"
                      : "border-white/15 bg-white/5 text-white/55 hover:border-white/35 hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Full-width card wall */}
        <div className="mt-10 border-t border-white/10 pt-8 pb-0">
          <div
            role="tabpanel"
            aria-label={`${activeTab.label} binder page`}
            data-binder-grid="true"
            className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:gap-6"
          >
            {activeTab.cards.slice(0, 12).map((card) => {
              const isFocused = focusedCardId === card.id;
              return (
                <div
                  key={card.id}
                  data-binder-source-cell="true"
                  className="rounded-[28px] border border-white/10 bg-white/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors hover:bg-white/[0.11] md:p-5"
                >
                  {isFocused ? (
                    <div
                      data-binder-source-placeholder={card.id}
                      className="aspect-[5/7] w-full rounded-[18px] border-2 border-dashed border-white/20 bg-white/[0.02]"
                    />
                  ) : (
                    <BinderCard
                      card={card}
                      onFocus={handleFocus}
                      sourceCell={null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {focusedCard && focusStage && sourceRectRef.current ? (
          <BinderFocusOverlay
            card={focusedCard}
            stage={focusStage}
            sourceRect={sourceRectRef.current.rect}
            onClose={closeFocusedCard}
          />
        ) : null}
      </div>
    </section>
  );
}

/**
 * BinderCard — magnetic 3D tilt + shine. Clicking opens a focus overlay.
 */
function BinderCard({
  card,
  onFocus,
  sourceCell,
}: {
  card: ShopCard;
  onFocus: (card: ShopCard, sourceCell: HTMLElement) => void;
  sourceCell: HTMLElement | null;
}) {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
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
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      setTilt({ x: 0, y: 0 });
      const cell = sourceCell ?? e.currentTarget.closest("[data-binder-source-cell]");
      if (cell) {
        onFocus(card, cell as HTMLElement);
      }
    },
    [card, onFocus, sourceCell],
  );

  const transform = `rotateY(${tilt.y.toFixed(2)}deg) rotateX(${tilt.x.toFixed(2)}deg)`;
  const shineBg = `radial-gradient(circle at ${shinePos.x.toFixed(1)}% ${shinePos.y.toFixed(1)}%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.18) 35%, rgba(255, 255, 255, 0.06) 65%, transparent 90%)`;

  return (
    <button
      type="button"
      data-binder-card="true"
      data-binder-card-id={card.id}
      data-binder-card-name={card.name}
      aria-label={`${card.name} — ${shortCondition(card.condition)} · ${formatPrice(card.price)}`}
      className="magnetic-card-wrapper focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-yellow/50"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div
        data-magnetic-card-inner="true"
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
            data-magnetic-card-shine="true"
            className="magnetic-card-shine"
            style={{ background: shineBg }}
            aria-hidden="true"
          />
        </div>
      </div>

      <span
        data-price-sticker="true"
        data-testid="price-sticker"
        className="pointer-events-none absolute bottom-2 left-2 z-30 flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-ink-black bg-brand-yellow text-center leading-none shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
      >
        <span
          data-price-sticker-condition="true"
          data-testid="price-sticker-condition"
          className="font-body text-[8px] font-bold uppercase text-ink-black"
        >
          {shortCondition(card.condition)}
        </span>
        <span
          data-price-sticker-price="true"
          data-testid="price-sticker-price"
          className="font-body text-[10px] font-bold text-ink-black"
        >
          {formatPrice(card.price)}
        </span>
      </span>
    </button>
  );
}

/**
 * BinderFocusOverlay — fixed overlay with a center-positioned card that
 * ALWAYS shows the real Pokémon TCG card back image. The card animates
 * from the source grid cell rect to the viewport center on open, holds
 * centered on "open", and animates back on close. No 3D rotation, no
 * front face, no cross-fade — the user explicitly asked to see the
 * actual back image, not a mirrored front.
 */
function BinderFocusOverlay({
  card,
  stage,
  sourceRect,
  onClose,
}: {
  card: ShopCard;
  stage: FocusStage;
  sourceRect: DOMRect;
  onClose: () => void;
}) {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [shinePos, setShinePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isFlipped, setIsFlipped] = useState(false);
  const animRef = useRef(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch {}
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
        setShinePos({ x: 50 - ay * 8, y: 50 + ax * 8 });
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (stage !== "open") return;
    setIsHovered(true);
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
    setIsHovered(false);
  };

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const innerStyle: React.CSSProperties = {
    transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`,
    transition: "transform 100ms ease-out",
  };

  const shineBg = `radial-gradient(circle at ${shinePos.x.toFixed(1)}% ${shinePos.y.toFixed(1)}%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.18) 35%, rgba(255, 255, 255, 0.06) 65%, transparent 90%)`;

  return (
    <div
      data-binder-focus-overlay="true"
      data-binder-focus-stage={stage}
      className="binder-focus-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        data-binder-focus-card="true"
        data-binder-focus-card-id={card.id}
        aria-label={`${card.name} focus card`}
        className={`binder-focus-card binder-focus-card--${stage === "closing" && isFlipped ? "closing-flipped" : stage} cursor-pointer`}
        style={{ ...cardStyleForStage(stage, sourceRect, isFlipped), perspective: "800px" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="w-full h-full relative rounded-2xl pointer-events-none"
          style={{ 
            ...innerStyle, 
            transformStyle: "preserve-3d" 
          }}
        >
          <div
            data-binder-focus-card-front="true"
            className="binder-focus-card__face binder-focus-card__face--front"
          >
            <img
              src={card.imageUrl}
              alt={card.name}
              referrerPolicy="no-referrer"
              draggable={false}
            />
            {/* Glossy reflection shine layer */}
            <div
              className="magnetic-card-shine"
              style={{
                background: shineBg,
                opacity: 1,
                transition: "opacity 250ms ease-out",
                mixBlendMode: "screen",
              }}
              aria-hidden="true"
            />
          </div>
          <div
            data-binder-focus-card-back="true"
            className="binder-focus-card__face binder-focus-card__face--back"
          >
            <img
              src={CARD_BACK_IMAGE_SRC}
              alt="Pokémon TCG card back"
              referrerPolicy="no-referrer"
              draggable={false}
            />
            {/* Glossy reflection shine layer */}
            <div
              className="magnetic-card-shine"
              style={{
                background: shineBg,
                opacity: 1,
                transition: "opacity 250ms ease-out",
                mixBlendMode: "screen",
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <aside
        data-binder-focus-details={stage === "closing" ? "hidden" : "visible"}
        aria-hidden={stage === "closing" ? "true" : "false"}
        className="binder-focus-details relative flex flex-col gap-4 rounded-[28px] border-4 border-ink-black bg-cream p-5 text-ink-black shadow-[8px_8px_0_rgba(26,26,26,1)] md:p-6"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-black bg-white text-ink-black shadow-[2px_2px_0_0_rgba(26,26,26,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(26,26,26,1)] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(26,26,26,1)] transition-all cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Card Name and Description */}
        <div className="mt-1">
          <div className="flex items-center gap-2">
            <h3 className="font-headline text-3xl font-bold leading-none md:text-4xl text-ink-black">
              {card.name}
            </h3>
          </div>
          <p className="mt-2.5 font-body text-xs leading-relaxed text-ink-black/70">
            {card.description}
          </p>
        </div>

        {/* Specifications Grid */}
        <dl className="grid grid-cols-2 gap-2 rounded-xl border-2 border-ink-black bg-white p-3 shadow-[3px_3px_0_0_rgba(26,26,26,1)]">
          <BinderFocusSpecItem
            icon={<Calendar size={14} className="text-brand-blue" />}
            label="Set / Year"
            value={`${card.set} · ${card.year}`}
          />
          <BinderFocusSpecItem
            icon={<Hash size={14} className="text-[#E94141]" />}
            label="Number"
            value={card.number}
          />
          <BinderFocusSpecItem
            icon={<Sparkles size={14} className="text-brand-yellow fill-brand-yellow/10" />}
            label="Rarity"
            value={card.rarity}
          />
          <BinderFocusSpecItem
            icon={<Flame size={14} className="text-brand-pink fill-brand-pink/10" />}
            label="Type"
            value={card.type}
          />
          <BinderFocusSpecItem
            icon={<Shield size={14} className="text-[#10B981]" />}
            label="Condition"
            value={card.condition}
          />
          <BinderFocusSpecItem
            icon={<Eye size={14} className="text-zinc-500" />}
            label="Views"
            value={card.views.toLocaleString("en-US")}
          />
        </dl>

        {/* Price and CTA Block */}
        <div className="relative mt-2 rounded-[22px] border-2 border-ink-black bg-brand-yellow p-4 shadow-[4px_4px_0_0_rgba(26,26,26,1)] overflow-hidden">
          {/* Subtle diagonal background stripes for texture */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,#ffffff08_25%,transparent_25%,transparent_50%,#ffffff08_50%,#ffffff08_75%,transparent_75%,transparent)] bg-[size:16px_16px] pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <span className="font-retro text-[6px] font-bold uppercase tracking-wider text-ink-black/50">
                PRICE VALUE
              </span>
              <div className="font-headline text-3xl font-black leading-none text-ink-black mt-1">
                {formatPrice(card.price)}
              </div>
            </div>
          </div>

          <Link
            href={`/shop?card=${card.id}`}
            className="relative z-10 mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink-black bg-ink-black px-5 py-3 font-body text-xs font-black text-white hover:-translate-y-0.5 active:translate-y-0 shadow-[2px_2px_0_0_rgba(26,26,26,1)] hover:shadow-[3px_3px_0_0_rgba(26,26,26,1)] active:shadow-[1px_1px_0_0_rgba(26,26,26,1)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
          >
            <span>View shop listing</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </aside>
    </div>
  );
}

function cardStyleForStage(
  stage: FocusStage,
  sourceRect: DOMRect,
  isFlipped: boolean = false,
): React.CSSProperties {
  // Focused card matches the source grid cell size. The centered position
  // places the card's center at the viewport center.
  const cardWidth = sourceRect.width;
  const cardHeight = sourceRect.height;
  const centeredX = `calc(50vw - ${cardWidth / 2}px)`;
  const centeredY = `calc(50vh - ${cardHeight / 2}px)`;
  const centered = `translate(${centeredX}, ${centeredY})`;
  // Source-rect transform: the original grid cell position.
  const fromSource = `translate(${sourceRect.left}px, ${sourceRect.top}px)`;

  const baseStyle: React.CSSProperties = {
    width: `${cardWidth}px`,
    height: `${cardHeight}px`,
  };

  if (stage === "opening") {
    return {
      ...baseStyle,
      ["--focus-from-translate" as string]: fromSource,
      ["--focus-to-translate" as string]: centered,
    };
  }
  if (stage === "open") {
    return {
      ...baseStyle,
      ["--focus-to-translate" as string]: centered,
      transform: `${centered} translateZ(0) scale(1) rotateY(${isFlipped ? 540 : 360}deg)`,
      transition: "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    };
  }
  // closing
  return {
    ...baseStyle,
    ["--focus-from-translate" as string]: fromSource,
    ["--focus-to-translate" as string]: centered,
  };
}

function BinderFocusSpec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-[10px] uppercase tracking-widest text-ink-black/50">
        {label}
      </dt>
      <dd className="mt-0.5 font-body text-sm font-bold text-ink-black">
        {value}
      </dd>
    </div>
  );
}

function BinderFocusSpecItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 p-1">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <dt className="font-body text-[8px] uppercase tracking-wider text-ink-black/45 leading-none">
          {label}
        </dt>
        <dd className="mt-1 font-body text-xs font-bold text-ink-black leading-tight truncate">
          {value}
        </dd>
      </div>
    </div>
  );
}
