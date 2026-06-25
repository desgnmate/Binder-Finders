"use client";

import { ArrowRight } from "lucide-react";

interface HeroContentProps {
  onCtaClick?: () => void;
}

/**
 * HeroContent — BinderFinders hero text + CTA, re-skinned with the
 * Umano (https://umanodesign.studio/) type scale.
 *
 * Scale references (live-captured on 2026-06-18 in a 980px viewport):
 *   - h1:       72px / weight 700 / tracking -1.44px / leading 1.083
 *               → Tailwind `text-7xl tracking-[-0.02em] leading-[1.083]`,
 *                 capped at `max-w-[700px] mx-auto` (Umano's H1 wrapper).
 *   - subtext:  24px / weight 600 / tracking -0.24px / leading 1.33
 *               → `text-2xl md:text-3xl font-medium tracking-[-0.01em]
 *                  leading-[1.33]`, capped at `max-w-[600px] mx-auto`.
 *   - CTA:      Inter 16/600 on Umano; we keep Fredoka `text-base
 *               font-semibold` per the brief and bump to `px-8 py-4`.
 */
export function HeroContent({ onCtaClick }: HeroContentProps) {
  const handleShopNow = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    window.location.href = "/shop";
  };

  return (
    <div
      data-hero-content="true"
      className="flex flex-col items-center px-4 pt-12 text-center md:pt-16"
    >
      <div
        data-headline-scale="umano"
        className="mx-auto max-w-[700px]"
      >
        <h1
          data-headline="true"
          data-headline-scale="umano"
          className="font-headline text-5xl font-bold tracking-[-0.02em] leading-[1.083] text-ink-black md:text-7xl"
        >
          Home of Vintage
          <br />
          Pokemon Cards
        </h1>
      </div>

      <div
        data-subtext-scale="umano"
        className="mx-auto max-w-[600px]"
      >
        <p
          data-subtext="true"
          data-subtext-scale="umano"
          className="mt-6 font-body text-2xl font-medium tracking-[-0.01em] leading-[1.33] text-ink-black md:text-3xl"
        >
          Hand-inspected Hoenn-era collectibles. Flatbed scanned, certified centering.
        </p>
      </div>

      <button
        type="button"
        onClick={handleShopNow}
        data-cta-pill="true"
        data-cta-dark="true"
        data-cta-scale="umano"
        className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-ink-black px-8 py-4 font-body text-base font-semibold text-white transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer"
      >
        <span>Shop Now</span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
