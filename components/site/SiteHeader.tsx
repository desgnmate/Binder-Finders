"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { BagContext } from "../bag/BagContext";
import { btnDark, btnWhite, wrap } from "./ui";

export const SITE_NAV = [
  { label: "Shop cards", href: "/shop" },
  { label: "Pokédex", href: "/pokedex" },
  { label: "About", href: "/about" },
  { label: "How holds work", href: "/how-holds-work" },
  { label: "Contact", href: "/contact" },
] as const;

/** Pill navigation for the info pages, card pages and bag. */
export function SiteHeader() {
  const pathname = usePathname();
  // The 404 page renders outside the store layout, where there is no bag.
  const count = useContext(BagContext)?.count ?? 0;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const isActive = (href: string) =>
    href === "/shop" ? pathname === "/shop" || pathname.startsWith("/cards/") : pathname === href;

  return (
    <header data-site-header className="sticky top-0 z-50 pt-4 md:pt-5">
      <div className={wrap}>
        <nav
          aria-label="Main"
          data-scrolled={scrolled ? "true" : undefined}
          className="rounded-[28px] border-[3px] border-ink-black bg-white py-2 pl-4 pr-2 shadow-[4px_4px_0_#1a1a1a] transition-[box-shadow,transform] duration-300 data-[scrolled=true]:shadow-[6px_6px_0_#1a1a1a] sm:py-2.5 sm:pl-6 sm:pr-3 md:rounded-full"
        >
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="BinderFinders home" className="flex shrink-0 items-center">
              <img src="/images/logo.png" alt="BinderFinders" className="h-5 w-auto sm:h-6 md:h-[26px]" />
            </Link>
            <ul className="ml-auto hidden items-center gap-5 lg:flex">
              {SITE_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className="px-1 py-2.5 font-body text-[15px] font-semibold text-ink-black no-underline hover:text-brand-blue aria-[current=page]:underline aria-[current=page]:decoration-brand-yellow aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-[6px]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex items-center gap-2 sm:gap-2.5 lg:ml-4">
              <Link
                href="/checkout"
                aria-label={`Bag, ${count} ${count === 1 ? "card" : "cards"}`}
                aria-current={pathname === "/checkout" ? "page" : undefined}
                className={`${btnWhite} !px-3.5 aria-[current=page]:!bg-brand-yellow`}
              >
                <ShoppingBag size={20} strokeWidth={2.2} aria-hidden="true" />
                <span>{count}</span>
              </Link>
              <Link href="/account" className={`${btnDark} !hidden sm:!inline-flex`}>
                Account
              </Link>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="site-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className={`${btnWhite} !px-3 lg:hidden`}
              >
                {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {open && (
            <ul id="site-menu" className="mt-3 flex flex-col gap-1 border-t-2 border-ink-black pt-3 lg:hidden">
              {SITE_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className="block rounded-xl px-3 py-3 font-body text-base font-semibold text-ink-black hover:bg-pastel-yellow aria-[current=page]:bg-brand-yellow"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="sm:hidden">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-3 font-body text-base font-semibold text-ink-black hover:bg-pastel-yellow"
                >
                  <UserRound size={18} aria-hidden="true" />
                  Account
                </Link>
              </li>
            </ul>
          )}
        </nav>
      </div>
    </header>
  );
}
