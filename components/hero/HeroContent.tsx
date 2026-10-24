"use client";

import { ArrowRight } from "lucide-react";
import { useCatalog } from "../CatalogProvider";
import { useEffect, useRef } from "react";

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
  const {
    settings: { content },
  } = useCatalog();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const heading = headingRef.current;
    const parent = heading?.parentElement;
    if (!heading || !parent || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      heading.style.fontSize = "";
      const width = Math.max(
        ...Array.from(heading.querySelectorAll("span")).map(
          (s) => s.getBoundingClientRect().width,
        ),
      );
      if (width > parent.clientWidth)
        heading.style.fontSize = `${(parseFloat(getComputedStyle(heading).fontSize) * parent.clientWidth) / width}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    window.addEventListener("resize", fit);
    void document.fonts?.ready.then(fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [content.heroLine1, content.heroLine2]);
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
        className="mx-auto w-full max-w-[1000px]"
      >
        <h1
          ref={headingRef}
          data-headline="true"
          data-headline-scale="umano"
          className="font-headline text-4xl font-bold tracking-[-0.02em] leading-[1.083] text-ink-black sm:text-5xl md:text-7xl"
        >
          <span className="whitespace-nowrap">{content.heroLine1}</span>
          <br />
          <span className="whitespace-nowrap">{content.heroLine2}</span>
        </h1>
      </div>

      <div data-subtext-scale="umano" className="mx-auto max-w-[600px]">
        <p
          data-subtext="true"
          data-subtext-scale="umano"
          className="mt-6 font-body text-lg font-medium tracking-[-0.01em] leading-[1.33] text-ink-black sm:text-2xl md:text-3xl"
        >
          {content.heroSubtitle}
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
        <span>{content.heroCta}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
