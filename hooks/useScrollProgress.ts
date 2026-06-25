"use client";

import { useEffect, useState } from "react";

/**
 * useScrollProgress — Umano-style continuous scroll-linked progress.
 *
 * Returns a `{ progress }` value in the inclusive range [0, 1] that
 * interpolates from 0 to 1 as the user scrolls from `scrollY = 0` to
 * `scrollY = SCROLL_RANGE`. Progress is monotonic non-decreasing in
 * `scrollY` and is clamped at both ends (handles over-scroll on touch
 * devices at the top, and never exceeds 1 past SCROLL_RANGE).
 *
 * Implementation:
 *   - one `scroll` listener on `window`, attached on mount, removed on
 *     unmount
 *   - rAF coalescing: at most one state update per animation frame
 *     even under bursty scroll
 *   - respects `prefers-reduced-motion: reduce` — when the media query
 *     matches, returns `progress = 1` and registers NO scroll listener
 *     (the hero snaps to its settled state; no animation occurs)
 */
export const SCROLL_RANGE = 150;

interface UseScrollProgressResult {
  progress: number;
}

export function useScrollProgress(): UseScrollProgressResult {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // prefers-reduced-motion → snap to settled state, no listener.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setProgress(1);
      return;
    }

    let frame: number | null = null;

    const evaluate = () => {
      frame = null;
      const y = window.scrollY;
      const next = y <= 0 ? 0 : Math.min(1, y / SCROLL_RANGE);
      setProgress(next);
    };

    const handleScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(evaluate);
    };

    // Capture the initial value (e.g. page refreshed mid-scroll).
    evaluate();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { progress };
}
