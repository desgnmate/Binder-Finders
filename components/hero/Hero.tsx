"use client";

import { useEffect, useState } from "react";
import { HeroNav } from "./HeroNav";
import { HeroContent } from "./HeroContent";
import { HeroCardShowcase } from "./HeroCardShowcase";
import { useScrollProgress } from "../../hooks/useScrollProgress";

/**
 * Hero — BinderFinders landing hero.
 *
 * Layout (full-screen, ~100vh):
 *   ┌──────────────────────────────────────────┐
 *   │  HeroNav (sticky pill)                   │  ← top
 *   │                                          │
 *   │  HeroContent (headline + subtext + CTA)  │  ← vertically centered
 *   │                                          │
 *   │  HeroCardShowcase (horizontal marquee)   │  ← bottom edge, bleeds
 *   └──────────────────────────────────────────┘     past the bottom border
 *
 * The card row partially clips through the hero's bottom edge ("sliding
 * out of the section"); the section's `overflow: hidden` cuts it cleanly.
 *
 * Scroll behavior (Umano "card-lift"):
 *   - At rest (scrollY = 0): full-bleed, square corners, no side margin.
 *   - As the user scrolls: side margins grow 0 → MARGIN_END_PX and bottom
 *     corners round 0 → --radius-hero, interpolated continuously from
 *     `progress` via inline `style` (the rAF loop IS the animation).
 *   - `prefers-reduced-motion: reduce` → snaps to the settled state.
 */
const MARGIN_END_PX = 32;

/**
 * Deterministic pseudo-random fills for the hero pixel-grid background.
 *
 * We sprinkle a LIGHT amount of cream/white tiles across the 32px grid so the
 * yellow background gains subtle texture without becoming busy. Each filled
 * cell gets a low, varied opacity (5%–12%) so the dots read as soft, light
 * grain — not dark specks.
 *
 * Determinism matters: this array is computed once at module load (SSR +
 * client produce identical output), avoiding React hydration mismatches and
 * keeping the pattern stable across re-renders.
 */
const GRID_CELL = 32; // px — matches the bg-[size:32px_32px] grid below.
function buildGridFills(): Array<{
  x: number;
  y: number;
  opacity: number;
  active: boolean;
}> {
  // Mulberry32 PRNG seeded so the output is stable across SSR/client.
  let seed = 0x2b4f1d17;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const cols = 120; // support wide screens up to 3840px
  const rows = 22; // tall enough to cover a 100vh hero at 32px cells
  const fills: Array<{ x: number; y: number; opacity: number; active: boolean }> = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // ~2% of cells get a fill — light and spacious across a wide viewport
      if (rand() < 0.02) {
        fills.push({
          x: x * GRID_CELL,
          y: y * GRID_CELL,
          opacity: 0.05 + rand() * 0.07, // 5%–12%
          active: rand() > 0.3, // 70% start as active
        });
      }
    }
  }
  return fills;
}
const GRID_FILLS = buildGridFills();

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);
  return reduced;
}

export function Hero() {
  const { progress } = useScrollProgress();
  const reducedMotion = useReducedMotion();
  const [fills, setFills] = useState(GRID_FILLS);

  useEffect(() => {
    const cols = 120;
    const rows = 22;

    const interval = setInterval(() => {
      setFills((prevFills) => {
        return prevFills.map((f) => {
          if (f.active) {
            // 20% chance to fade out
            if (Math.random() < 0.20) {
              return { ...f, active: false };
            }
            return f;
          } else {
            // 20% chance to teleport and fade in
            if (Math.random() < 0.20) {
              const newX = Math.floor(Math.random() * cols) * GRID_CELL;
              const newY = Math.floor(Math.random() * rows) * GRID_CELL;
              return {
                ...f,
                x: newX,
                y: newY,
                active: true,
                opacity: 0.05 + Math.random() * 0.07,
              };
            }
            return f;
          }
        });
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const [marginEnd, setMarginEnd] = useState(32);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setMarginEnd(12);
      } else if (window.innerWidth < 768) {
        setMarginEnd(16);
      } else {
        setMarginEnd(32);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reduced motion → snap straight to the settled card-lift state.
  const step = reducedMotion ? 1 : progress;
  const marginPx = step * marginEnd;

  // At progress < 1 we write "0px" so the CSS engine doesn't accumulate
  // calc strings into inline-style. At progress = 1 we write the clamp
  // token so it resolves at runtime.
  const radiusValue = step >= 1 ? "var(--radius-hero)" : "0px";

  // Width compensation: the scroll-linked margin would push the outer box
  // past the viewport on the right (clipped by overflow-hidden). Subtracting
  // 2*marginPx keeps it inside so the margin reads symmetric on both sides.
  const sectionWidth = `calc(100% - ${marginPx * 2}px)`;

  return (
    <section
      data-hero-bg="brand-yellow"
      data-hero-style="umano"
      data-hero-full-width="true"
      data-hero-progress={progress.toFixed(2)}
      data-hero-reduced-motion={reducedMotion ? "true" : "false"}
      data-hero-radius-scale="clamp(24px,4vw,42px)"
      className="relative flex min-h-screen flex-col overflow-hidden border-[3px] border-ink-black bg-brand-yellow"
      style={{
        marginLeft: `${marginPx}px`,
        marginRight: `${marginPx}px`,
        width: sectionWidth,
        borderBottomLeftRadius: radiusValue,
        borderBottomRightRadius: radiusValue,
      }}
    >
      {/* Graph paper grid for tactile card-table depth. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a06_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a06_1px,transparent_1px)] bg-[size:32px_32px]"
      />
      {/* Subtle random filled grid tiles — soft, low-opacity LIGHT (cream)
          tiles placed naturally across the grid for texture without clutter.
          Deterministic (built once at module load) so SSR + client sync. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        {fills.map((f, i) => (
          <rect
            key={i}
            x={f.x}
            y={f.y}
            width={GRID_CELL}
            height={GRID_CELL}
            fill="#fff6e0"
            opacity={f.active ? f.opacity : 0}
            style={{
              transition: "opacity 1.5s ease-in-out",
            }}
          />
        ))}
      </svg>
      {/* Soft radial vignette to lift the centered text off the texture. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(254,221,37,0.0)_0%,rgba(254,221,37,0.0)_55%,rgba(26,26,26,0.06)_100%)]"
      />

      {/* Top: sticky pill nav. */}
      <div className="relative z-20 flex w-full justify-center px-4 pt-6">
        <HeroNav />
      </div>

      {/* Middle: headline + subtext + CTA, centered in the remaining space
          above the card row. Keeps the marquee from overlapping the text. */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
        <HeroContent />
      </div>

      {/* Bottom: full-width horizontal card marquee, anchored to the bottom
          edge. The cards bleed past the section border; overflow-hidden on
          this section clips them cleanly. */}
      <div className="relative z-10 mt-auto w-full">
        <HeroCardShowcase />
      </div>
    </section>
  );
}
