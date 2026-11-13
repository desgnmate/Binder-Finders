"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ShoppingBag, UserRound } from "lucide-react";
import { useContext } from "react";
import { BagContext } from "./bag/BagContext";

interface SubpageHeaderProps {
  backHref?: string;
  title?: string;
}

export function SubpageHeader({ backHref = "/", title }: SubpageHeaderProps) {
  const pathname = usePathname();
  const bagCtx = useContext(BagContext);
  const count = bagCtx?.count ?? 0;


  const isPokedex = pathname === "/pokedex";

  return (
    <header data-subpage-header className={`${isPokedex ? "relative" : "sticky top-0"} z-50 border-b-4 border-ink-black bg-cream/95 px-4 py-3.5 backdrop-blur md:px-8`}>
      <div className="flex w-full items-center justify-between gap-4">
        {/* Left Side: Back Arrow and Logo */}
        <Link
          href={backHref}
          className="flex items-center gap-2.5 transition-all hover:opacity-75 active:scale-95"
          aria-label="Go back"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink-black bg-white shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <ArrowLeft size={16} className="text-ink-black stroke-[3]" />
          </div>
          <img
            src="/images/logo.png"
            alt="BinderFinders Logo"
            className="h-6 sm:h-7 w-auto object-contain [image-rendering:auto]"
          />
          {title && (
            <span className="hidden sm:inline font-body text-sm font-black uppercase tracking-wide text-ink-black/45">
              · {title}
            </span>
          )}
        </Link>

        {/* Right Side: Navigation Links */}
        <nav className="flex items-center gap-4 sm:gap-6 font-body text-sm font-semibold text-ink-black">
          <Link
            href="/pokedex"
            className={`inline-flex items-center transition-colors hover:text-brand-blue ${
              isPokedex
                ? "underline decoration-4 underline-offset-4 decoration-brand-blue font-black"
                : "text-ink-black/75 hover:opacity-100"
            }`}
          >
            Pokédex
          </Link>
          <Link
            href="/#binder"
            className="hidden sm:inline-flex items-center text-ink-black/75 transition-colors hover:text-brand-blue"
          >
            Binder
          </Link>
          {[
            { label: "About", href: "/about" },
            { label: "How holds work", href: "/how-holds-work" },
            { label: "Contact", href: "/contact" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden md:inline-flex items-center text-ink-black/75 transition-colors hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}
          
          {/* Dynamic My Bag icon with an accessible item count */}
          <Link
            href="/checkout"
            aria-label={`My Bag (${count} cards)`}
            className="inline-flex h-11 w-11 items-center justify-center p-2 text-ink-black hover:text-brand-blue hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"
          >
            <ShoppingBag size={20} strokeWidth={2} aria-hidden="true" />
          </Link>

          <Link
            href="/account"
            aria-label="Account"
            className="inline-flex h-10 w-10 sm:h-auto sm:w-auto items-center justify-center gap-1.5 rounded-full border-2 border-ink-black bg-ink-black p-2 sm:px-4 sm:py-2 text-white hover:bg-brand-blue hover:-translate-y-0.5 active:scale-95 transition-all duration-150 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
          >
            <UserRound size={16} aria-hidden="true" />
            <span className="hidden sm:inline text-sm font-semibold">Account</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
