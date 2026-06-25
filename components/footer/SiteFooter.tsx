"use client";

import Link from "next/link";
import { ArrowRight, Mail, MapPin, BookOpen } from "lucide-react";
import { WalkingTrainer } from "../trainer/WalkingTrainer";

// ---------------------------------------------------------------------------
// Footer data
// ---------------------------------------------------------------------------

const POKEMON_FACTS = [
  "Base Set Charizard was originally ¥300 in Japan.",
  "Only 121 PSA 10 Base Set Charizards exist worldwide.",
  "The first Pokémon TCG cards were released in Oct 1996.",
  "WOTC printed over 50 billion Pokémon cards by 2003.",
] as const;

export function SiteFooter() {
  // Pick a deterministic fun fact (based on day-of-year for variety)
  const factIndex =
    typeof window !== "undefined"
      ? Math.floor(Date.now() / 86400000) % POKEMON_FACTS.length
      : 0;

  return (
    <footer
      id="contact"
      data-site-footer="true"
      className="pokeball-cursor relative bg-[#7b39ed] text-white"
    >
      {/* Theme bar with walking trainer */}
      <div className="relative w-full bg-[#7b39ed]">
        <WalkingTrainer />
      </div>

      <div
        className="relative overflow-hidden bg-ink-black border-t-4 border-ink-black px-4 pt-12 pb-6 md:px-8 md:pt-16 md:pb-8"
        style={{
          borderTopLeftRadius: "var(--radius-hero)",
          borderTopRightRadius: "var(--radius-hero)",
        }}
      >
        {/* Graph paper grid lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:32px_32px]"
        />

        {/* ─── Content ─── */}
        <div className="relative z-10 mx-auto max-w-7xl">

          {/* Row 1: Headline CTA + Mascot card */}
          <div className="relative overflow-hidden rounded-[28px] border-4 border-ink-black bg-brand-yellow p-5 shadow-[6px_6px_0_0_rgba(26,26,26,1)] transition-transform duration-300 hover:scale-[1.005] md:p-8">
            {/* Diagonal stripe texture on yellow (properly constrained) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[24px] bg-[linear-gradient(45deg,#ffffff10_25%,transparent_25%,transparent_50%,#ffffff10_50%,#ffffff10_75%,transparent_75%,transparent)] bg-[size:16px_16px] opacity-40"
            />
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-headline text-3xl font-bold leading-none text-ink-black md:text-5xl">
                    Need a closer look?
                  </h2>
                  <p className="mt-2 max-w-md font-body text-xs leading-relaxed text-ink-black/60 md:text-sm">
                    Ask for extra scans, corner photos, condition notes, holds,
                    or a bundle quote.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-full border-4 border-ink-black bg-ink-black px-5 py-2.5 font-body text-sm font-bold text-white shadow-[3px_3px_0_0_rgba(254,221,37,1)] transition-all hover:bg-brand-pink hover:text-ink-black hover:shadow-[3px_3px_0_0_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Browse cards</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link
                  href="/#binder"
                  className="inline-flex items-center gap-2 rounded-full border-4 border-ink-black bg-white px-5 py-2.5 font-body text-sm font-bold text-ink-black shadow-[3px_3px_0_0_rgba(26,26,26,1)] transition-all hover:bg-brand-blue hover:text-white hover:-translate-y-0.5 active:translate-y-0"
                >
                  <BookOpen size={14} aria-hidden="true" />
                  <span>Open Binder</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Row 2: Brand Profile Left, Contact Right */}
          <div className="mt-12 flex flex-col md:flex-row items-center md:items-start justify-between gap-8 md:gap-12 w-full text-center md:text-left">
            {/* Left Column: Logo & Description */}
            <div className="flex flex-col items-center md:items-start gap-4 max-w-md">
              <Link
                href="/"
                className="inline-block transition-opacity hover:opacity-85"
              >
                <img
                  src="/images/logo.png"
                  alt="BinderFinders Logo"
                  className="h-10 w-auto object-contain [image-rendering:auto]"
                />
              </Link>
              <p className="font-body text-sm leading-relaxed text-white/60">
                BinderFinders is a vintage Pokémon TCG shop specializing in
                Hoenn-era collectibles. Every card is hand-inspected, flatbed
                scanned, and graded for centering before listing.
              </p>
            </div>

            {/* Right Column: Contact Info */}
            <div className="flex flex-col items-center md:items-end gap-3 shrink-0 self-center md:self-auto mt-2 md:mt-0">
              <a
                href="mailto:hello@binderfinders.com"
                className="inline-flex items-center gap-2.5 rounded-full border-2 border-ink-black bg-brand-blue px-4 py-2 font-body text-sm font-bold text-white shadow-[3px_3px_0_0_rgba(26,26,26,1)] hover:bg-white hover:text-ink-black hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-white/20 bg-white/10">
                  <Mail size={12} aria-hidden="true" />
                </div>
                <span>hello@binderfinders.com</span>
              </a>

              <div className="flex items-center gap-1.5 text-white/40 mt-1">
                <MapPin
                  size={12}
                  aria-hidden="true"
                />
                <span className="font-retro text-[8px] uppercase tracking-wider">
                  Melbourne, Australia
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Fun fact ticker + copyright bar */}
          <div className="mt-12 flex flex-col gap-6 border-t-2 border-dashed border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">

            {/* Copyright */}
            <p className="shrink-0 font-retro text-[7px] uppercase tracking-[2px] text-white/20">
              © {new Date().getFullYear()} — Binder Finders Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
