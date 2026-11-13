// Shared class names for the info pages, card page and bag, so they all match
// the approved BinderFinders page designs.

export const btn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-[3px] border-ink-black bg-brand-yellow px-5 font-body text-[15px] font-semibold text-ink-black shadow-[3px_3px_0_#1a1a1a] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#1a1a1a] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_#1a1a1a] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-brand-blue";
export const btnDark = `${btn} !bg-ink-black !text-white`;
export const btnWhite = `${btn} !bg-white`;

export const box =
  "rounded-[24px] border-[3px] border-ink-black bg-white shadow-[6px_6px_0_#1a1a1a]";

export const chip =
  "inline-flex min-h-[24px] items-center rounded-full border-2 border-ink-black bg-white px-2.5 font-body text-xs font-semibold text-ink-black";

/** Small pixel-font label, e.g. section eyebrows. */
export const px = "font-retro text-[10px] uppercase leading-relaxed tracking-[0.04em]";

export const headline = "font-headline font-normal tracking-[-0.01em]";

export const input =
  "min-h-[48px] w-full rounded-[14px] border-[3px] border-ink-black bg-white px-3.5 font-body text-base text-ink-black placeholder:text-ink-black/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/40 read-only:bg-ink-black/5";

export const wrap = "mx-auto w-full max-w-[1280px] px-4 md:px-8";

/** Card face colour by Pokémon type, used where a scan is missing. */
export const TYPE_COLORS: Record<string, string> = {
  Fire: "#ff9a6b",
  Water: "#8cc7ff",
  Grass: "#9fdc8a",
  Lightning: "#fedd25",
  Psychic: "#d7b4ff",
  Fighting: "#e8a77a",
  Darkness: "#9a9a9a",
  Metal: "#cfd6dc",
  Colorless: "#f1efe6",
  Dragon: "#e6c56b",
  Fairy: "#ffc2df",
  Poison: "#c9a2e8",
};
