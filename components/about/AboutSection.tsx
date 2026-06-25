"use client";

import { useEffect, useState } from "react";

const BRAND_PROMISES = [
  {
    title: "100% Flatbed Scans",
    body: "Raw, honest pixels. Corners, edges, holo wear.",
    spriteId: 54, // Psyduck
    pokemonName: "Psyduck",
  },
  {
    title: "PSA Grades & Raw Tags",
    body: "Clear grade tags. We price by condition.",
    spriteId: 202, // Wobbuffet
    pokemonName: "Wobbuffet",
  },
  {
    title: "Fast Hold Requests",
    body: "One tap. Reply within 24 hours.",
    spriteId: 194, // Wooper
    pokemonName: "Wooper",
  },
] as const;

export function AboutSection() {
  const [activeBubble, setActiveBubble] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBubble((current) => (current + 1) % BRAND_PROMISES.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      id="about"
      data-about-section="true"
      className="pokeball-cursor px-4 pt-12 pb-16 md:px-8 md:pt-16 md:pb-24 overflow-hidden"
    >
      {/* Outer container: keeps the main neobrutalist outline & drop shadow */}
      <div className="relative rounded-[28px] border-[3px] border-ink-black bg-cream bg-[radial-gradient(#e5dfcd_1.5px,transparent_1.5px)] [background-size:24px_24px] p-5 md:p-8 lg:p-10 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)]">

        {/* Background watermark */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">

          {/* Left: Collector's Journal / Notebook Layout */}
          <div className="lg:col-span-6 flex flex-col justify-between relative rounded-2xl border-4 border-ink-black bg-white p-5 md:p-7 overflow-hidden min-h-[380px] lg:min-h-[460px] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">

            {/* Lined Notebook Paper Background Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(49,148,238,0.06)_1px,transparent_1px)] bg-[size:100%_28px] pointer-events-none" />

            {/* Left Margin Notebook Red Line */}
            <div className="absolute left-[30px] md:left-[42px] top-0 bottom-0 border-l-[1.5px] border-brand-pink pointer-events-none" />

            {/* Vintage Sticky Tape & Magikarp Sticker Aesthetic in Top Corner */}
            <div className="absolute right-4 top-2 pointer-events-none flex flex-col items-end">
              <img
                src="/sprites/gen3/129.png"
                alt="Magikarp Sticker"
                className="w-10 h-10 object-contain [image-rendering:pixelated] rotate-[-12deg] opacity-80 z-10"
                width={40}
                height={40}
              />
              <div className="w-20 h-5 bg-brand-yellow/35 border border-brand-yellow/45 rotate-12 shadow-sm backdrop-blur-[1px] -mt-5 mr-1" />
            </div>

            {/* Spiral Notebook Rings on Left Side */}
            <div className="absolute left-1 md:left-2 top-6 bottom-6 flex flex-col justify-between py-2 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-4 h-2 rounded-full border-[1.5px] border-ink-black bg-gradient-to-r from-gray-400 to-gray-200 shadow-[1px_1px_1px_rgba(0,0,0,0.1)]" />
                  <div className="w-1 h-1 rounded-full bg-ink-black/25 -ml-0.5" />
                </div>
              ))}
            </div>

            {/* Journal Text Content */}
            <div className="pl-8 md:pl-12 pr-6 md:pr-10 flex-1 flex flex-col justify-center">
              <div className="w-full max-w-xl mx-auto text-left">
                <h2 className="font-headline text-3xl font-black leading-[1.2] text-ink-black sm:text-4xl lg:text-[42px] xl:text-[48px] text-left">
                  Scans you can read. Cards you can trust.
                </h2>

                <p className="mt-6 font-body text-sm leading-relaxed text-ink-black/85 md:text-base text-left">
                  A small collector desk for vintage Pokémon. Every card comes with a real flatbed scan — no stock photos, no mystery conditions, no surprises.
                </p>
              </div>
            </div>

            {/* Notebook Footer: Vintage Stamp with Koffing Sprite Badge */}
            <div className="pl-8 md:pl-12 mt-6 flex items-center gap-3 pt-4 border-t border-ink-black/10">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink-black bg-brand-pink bg-[radial-gradient(#e5dfcd_1px,transparent_1px)] [background-size:8px_8px] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] overflow-hidden">
                <img
                  src="/sprites/gen3/109.png"
                  alt="Koffing Badge"
                  className="w-8 h-8 object-contain [image-rendering:pixelated]"
                  width={32}
                  height={32}
                />
              </div>
              <div>
                <div className="font-headline text-lg font-bold text-ink-black leading-none">1999 — 2002 Era</div>
                <div className="font-retro text-[6px] uppercase tracking-wider text-ink-black/50 mt-1">Vintage Gen 1 Specialists</div>
              </div>
            </div>
          </div>

          {/* Right: cropped Pokémon sprites, scaled large and tucked shoulder-to-shoulder */}
          <div className="lg:col-span-6 flex flex-row items-end justify-center gap-0 sm:gap-1 w-full py-4 lg:py-0 self-center relative">

            {BRAND_PROMISES.map((promise, index) => {
              // Each sprite sways around its feet with a tiny offset so the row feels alive.
              const spriteSwayClass =
                index === 0 ? "[--about-sprite-tilt:-3deg] [--about-sprite-delay:-0.4s]" :
                  index === 2 ? "[--about-sprite-tilt:3deg] [--about-sprite-delay:-0.9s]" :
                    "[--about-sprite-tilt:1deg] [--about-sprite-delay:-1.3s]";

              const zIndexClass =
                index === 1 ? "z-20" : "z-10";

              return (
                <article
                  key={promise.title}
                  data-testid="about-promise-card"
                  className={`group relative flex flex-col items-center text-center cursor-pointer select-none ${activeBubble === index ? "z-40" : zIndexClass} hover:z-40 transition-all duration-300`}
                >
                  {/* Cropped showcase sprite copy: no transparent 128px canvas padding, so it reads much larger */}
                  <img
                    src={`/sprites/about-showcase/${promise.spriteId}.png`}
                    alt={promise.pokemonName}
                    className={`about-sprite-sway w-32 sm:w-40 md:w-48 lg:w-[180px] xl:w-[220px] h-auto -mx-1 sm:-mx-1.5 md:-mx-2 lg:mx-0 object-contain [image-rendering:pixelated] ${spriteSwayClass}`}
                    width={220}
                    height={220}
                  />

                  {/* Clean retro-themed text badge under the sprite */}
                  <span className="mt-2 font-retro text-[8px] md:text-[9px] tracking-wider text-ink-black/60 group-hover:text-brand-blue transition-colors uppercase leading-none">
                    {promise.pokemonName}
                  </span>

                  {/* Message bubble cycles one sprite at a time. */}
                  <div className={`absolute bottom-full mb-3 w-48 bg-ink-black text-white text-[11px] p-3 rounded-xl border-2 border-ink-black shadow-[4px_4px_0px_0px_rgba(254,221,37,1)] pointer-events-none z-30 font-body leading-tight transition-all duration-300 ${activeBubble === index ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
                    <h4 className="font-bold text-brand-yellow mb-1 font-headline text-sm">
                      {promise.title}
                    </h4>
                    <p className="text-white/80 font-body text-[10px]">
                      {promise.body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
