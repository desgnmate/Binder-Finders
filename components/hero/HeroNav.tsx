"use client";

import { useState } from "react";
import { ShoppingBag, UserRound, Menu, X } from "lucide-react";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Shop Cards", href: "/#binder" },
  { label: "Pokedex", href: "/pokedex" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
] as const;

/**
 * HeroNav — BinderFinders floating pill nav, re-skinned with the Umano
 * (https://umanodesign.studio/) shape + type scale.
 *
 *   - Width-constrained: the pill is bounded to `max-w-3xl mx-auto` so
 *     it reads as a small floating object (~75% of viewport at 980px),
 *     incorporating the new transparent logo.
 *   - Type scale: items use Fredoka `text-base font-semibold`.
 *   - Account sits beside a prominent bag icon so shopping stays accessible.
 *   - Sticky positioning is preserved.
 */
export function HeroNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      data-nav-sticky="true"
      className="sticky top-4 z-50 flex w-full justify-center px-4"
    >
      <nav
        aria-label="Primary"
        data-nav-pill="true"
        data-nav-type-scale="umano"
        className="mx-auto flex-1 max-w-4xl rounded-3xl bg-white px-4 py-3 md:px-6 md:py-5 md:rounded-full border-2 border-ink-black shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] transition-transform duration-300 hover:scale-[1.01]"
      >
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center transition-opacity hover:opacity-85"
          >
            <img
              src="/images/logo.png"
              alt="BinderFinders Logo"
              className="h-7 w-auto object-contain [image-rendering:auto]"
            />
          </Link>

          <div className="flex items-center gap-4 md:gap-6">
            <ul className="hidden md:flex items-center gap-6 font-body text-base font-semibold text-ink-black">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-all duration-200 hover:bg-brand-pink hover:text-ink-black hover:-translate-y-0.5 inline-block active:scale-95"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/checkout"
              aria-label="My Bag"
              className="flex h-12 w-12 items-center justify-center p-2 text-ink-black transition-all duration-200 hover:text-brand-blue hover:-translate-y-0.5 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"
            >
              <ShoppingBag size={22} strokeWidth={2} aria-hidden="true" />
            </Link>

            <Link
              href="/account"
              aria-label="Account"
              className="flex h-10 w-10 sm:h-auto sm:w-auto items-center justify-center gap-1.5 rounded-full border-2 border-ink-black bg-ink-black p-2 sm:px-3.5 sm:py-2.5 text-white transition-all duration-200 hover:bg-brand-blue hover:-translate-y-0.5 active:scale-95 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
            >
              <UserRound size={16} aria-hidden="true" />
              <span className="hidden sm:inline text-sm font-semibold">Account</span>
            </Link>

            {/* Mobile hamburger toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink-black bg-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] active:scale-95 transition-transform"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <div className="md:hidden mt-3 pt-3 border-t-2 border-ink-black/10">
            <ul className="flex flex-col gap-1 font-body text-base font-semibold text-ink-black">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl px-4 py-2.5 transition-all duration-200 hover:bg-brand-pink active:scale-[0.98]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </div>
  );
}
