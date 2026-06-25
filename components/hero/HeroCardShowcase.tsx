"use client";

import { useEffect, useRef, useState } from "react";
import { SHOP_CARDS, shortCondition, formatPrice, type ShopCard } from "../../lib/data";

/**
 * HeroCardShowcase — a premium, infinite horizontal marquee of real TCG
 * collectible cards that slides along the bottom of the hero.
 *
 * Motion model (rAF-driven for smooth speed changes):
 *   - The track's `transform: translate3d(-offset, 0, 0)` is set every
 *     animation frame from a JS `offset` value that accumulates at `speed`
 *     px/ms. Because we own the raw pixel offset (NOT a CSS keyframe),
 *     changing `speed` never causes a jump — the cards simply drift faster
 *     or slower in place. (Transitioning CSS `animation-duration` would
 *     snap the position; that's why we don't use it.)
 *   - Two identical sets are rendered back-to-back; the offset wraps via
 *     `offset % setWidth` for a seamless loop.
 *   - Hover the row → `targetSpeed` eases toward a slow drift (it never
 *     stops). The ease happens on the speed value, so it's buttery.
 *   - Off-screen → the IntersectionObserver cancels the rAF loop entirely
 *     (saves CPU / battery).
 *   - `prefers-reduced-motion` → no loop; static centered single set.
 *
 * The lower portion of the card row bleeds slightly past the hero's bottom
 * edge; the hero section's `overflow: hidden` clips it. See `.hero-marquee*`
 * in app/globals.css.
 */

/** Base drift speed in px per ms (~36px/s → a full ~3400px set loops in ~60s). */
const BASE_SPEED = 0.06;
/** Hover slows the drift to this fraction of base (calm, not stopped). */
const HOVER_SPEED_FACTOR = 0.2;

/** Deterministic per-card tilt + lift so the row looks hand-laid.
 *  Tilts alternate sign so neighbours lean opposite ways; lifts are all
 *  ≥ 0 (downward only) so NO card ever extends above the row box — this
 *  keeps every card top fully visible under the container's overflow. */
function cardPose(index: number): { tilt: number; lift: number } {
  const tiltPattern = [-4, 3, -3, 4, -2, 2, -3, 4];
  const liftPattern = [0, 4, 2, 6, 0, 4, 2, 6];
  const tilt = tiltPattern[index % tiltPattern.length];
  const lift = liftPattern[index % liftPattern.length];
  return { tilt, lift };
}

export function HeroCardShowcase() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const setRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = rootRef.current;
    const track = trackRef.current;
    const setEl = setRef.current;
    if (!root || !track || !setEl) return;

    // Respect reduced-motion: render static, no loop.
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) {
      setReducedMotion(true);
      return;
    }

    // One set width drives the seamless modulo wrap. Re-measured on resize.
    let setWidth = setEl.offsetWidth || 1;
    const measure = () => {
      const w = setEl.offsetWidth;
      if (w > 0) setWidth = w;
    };
    measure();

    let offset = 0;
    let speed = BASE_SPEED;
    let targetSpeed = BASE_SPEED;
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't teleport the cards.
      const dt = Math.min(64, now - last);
      last = now;
      // Ease the actual speed toward the target (smooth slowdown / speedup).
      speed += (targetSpeed - speed) * Math.min(1, dt / 180);
      offset = (offset + speed * dt) % setWidth;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      raf = requestAnimationFrame(loop);
    };

    // Hover → slow down (ease toward slow drift). Pointer events cover both
    // mouse and touch-hover-capable devices; we don't fully stop on hover.
    const onEnter = () => {
      targetSpeed = BASE_SPEED * HOVER_SPEED_FACTOR;
    };
    const onLeave = () => {
      targetSpeed = BASE_SPEED;
    };
    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mouseleave", onLeave);

    // Pause the loop entirely when the hero leaves the viewport.
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                setInView(e.isIntersecting);
                if (e.isIntersecting && raf === 0) {
                  last = performance.now();
                  raf = requestAnimationFrame(loop);
                } else if (!e.isIntersecting && raf !== 0) {
                  cancelAnimationFrame(raf);
                  raf = 0;
                }
              }
            },
            { threshold: 0 },
          )
        : null;
    io?.observe(root);

    // Keep setWidth accurate if the layout reflows (resize / card load).
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    ro?.observe(setEl);

    // Kick off the loop.
    raf = requestAnimationFrame(loop);

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      io?.disconnect();
      ro?.disconnect();
    };
  }, []);

  // The set of cards shown in the marquee. Rendered twice for a seamless loop.
  const cards = SHOP_CARDS;

  return (
    <div
      ref={rootRef}
      data-hero-card-showcase="true"
      data-inview={inView ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="hero-marquee"
    >
      {/* Soft fade masks on the left/right edges so cards appear/disappear
          gently instead of popping at the clip boundary. */}
      <div className="hero-marquee__fade hero-marquee__fade--left" aria-hidden="true" />
      <div className="hero-marquee__fade hero-marquee__fade--right" aria-hidden="true" />

      <div ref={trackRef} className="hero-marquee__track">
        {/* Render the set twice for a seamless infinite loop. The first set
            is the measured reference (setRef); the second continues it. */}
        {[0, 1].map((dup) => (
          <div
            key={dup}
            ref={dup === 0 ? setRef : undefined}
            className="hero-marquee__set"
            aria-hidden={dup === 1}
          >
            {cards.map((card, i) => (
              <ShowcaseCard key={`${dup}-${card.id}`} card={card} index={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseCard({ card, index }: { card: ShopCard; index: number }) {
  const { tilt, lift } = cardPose(index);
  return (
    <div
      className="hero-marquee__card"
      style={
        {
          "--card-tilt": `${tilt}deg`,
          "--card-lift": `${lift}px`,
        } as React.CSSProperties
      }
    >
      <img
        src={card.imageUrl}
        alt={`${card.name} — ${shortCondition(card.condition)} · ${formatPrice(card.price)}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}
