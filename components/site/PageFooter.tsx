import Link from "next/link";
import { wrap } from "./ui";

export const FOOTER_LINKS = [
  {
    title: "Shop",
    links: [
      { label: "All cards", href: "/shop" },
      { label: "Pokédex", href: "/pokedex" },
      { label: "Your bag", href: "/checkout" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "How holds work", href: "/how-holds-work" },
      { label: "Shipping & returns", href: "/shipping-returns" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Store",
    links: [
      { label: "About us", href: "/about" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of sale", href: "/terms" },
    ],
  },
] as const;

const COMPACT_LINKS = [
  { label: "How holds work", href: "/how-holds-work" },
  { label: "Shipping & returns", href: "/shipping-returns" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "/contact" },
];

const DISCLAIMER = "Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company.";

/** Footer for the info pages and card pages. `compact` is the one-line version for the bag. */
export function PageFooter({ compact = false }: { compact?: boolean }) {
  const year = new Date().getFullYear();
  if (compact) {
    return (
      <footer className="bg-[#7b39ed] py-7 font-body text-sm text-white">
        <div className={`${wrap} flex flex-wrap justify-between gap-4`}>
          <span>© {year} BinderFinders · Melbourne, Australia</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {COMPACT_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-white no-underline hover:text-brand-yellow">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    );
  }
  return (
    <footer className="bg-[#7b39ed] pb-8 pt-14 font-body text-white">
      <div className={`${wrap} flex flex-col gap-10`}>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-3.5 md:col-span-1">
            <Link href="/" aria-label="BinderFinders home" className="self-start">
              <img src="/images/logo.png" alt="BinderFinders" className="h-6 w-auto" />
            </Link>
            <p className="m-0 text-[15px] leading-relaxed">
              A small collector desk for vintage Pokémon cards in Melbourne, Australia.
            </p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="mb-3 font-retro text-[10px] font-normal text-brand-yellow">{group.title}</h2>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white no-underline hover:text-brand-yellow">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t-2 border-white/35 pt-5 text-[13px] text-[#efe6ff]">
          <span>© {year} BinderFinders</span>
          <span>{DISCLAIMER}</span>
        </div>
      </div>
    </footer>
  );
}
