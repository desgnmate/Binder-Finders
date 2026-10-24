"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { LayoutDashboard, LogOut, Package, UserRound } from "lucide-react";
import { HeroNav } from "../hero/HeroNav";
import { SiteFooter } from "../footer/SiteFooter";
import { RevealFooterLayout } from "../RevealFooterLayout";
import { customerSignOut } from "../../app/account/actions";

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-bold text-ink-black/70 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      <LogOut size={16} aria-hidden="true" />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

const navLinks = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders & Holds", icon: Package },
  { href: "/account/profile", label: "Profile & Security", icon: UserRound },
];

export function AccountShell({
  children,
  footer = <SiteFooter />,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard =
    pathname === "/account" ||
    pathname === "/account/profile" ||
    pathname === "/account/orders" ||
    pathname.startsWith("/account/orders/");

  // Auth pages (login, signup, forgot-password, verify, reset-password)
  if (!isDashboard) {
    return (
      <RevealFooterLayout footer={footer}>
        <div className="min-h-screen bg-cream text-ink-black flex flex-col justify-between">
          <HeroNav />
          <main className="customer-account flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
            <section className="customer-box w-full max-w-[480px]">
              <div className="mb-6 flex justify-center">
                <Link href="/" aria-label="BinderFinders home">
                  <Image
                    className="customer-logo"
                    src="/images/logo.png"
                    alt="BinderFinders"
                    width={220}
                    height={43}
                    priority
                  />
                </Link>
              </div>
              {children}
              <p className="customer-back-link mt-4 text-center">
                <Link
                  href="/shop"
                  className="text-sm font-semibold hover:underline"
                >
                  ← Back to the shop
                </Link>
              </p>
            </section>
          </main>
        </div>
      </RevealFooterLayout>
    );
  }

  return (
    <RevealFooterLayout footer={footer}>
      <div className="account-workspace min-h-screen bg-cream text-ink-black flex flex-col">
        <a className="account-skip" href="#account-content">
          Skip to account content
        </a>
        {/* ── Homepage Floating Sticky Navigation Bar ── */}
        <HeroNav />

        {/* ── Main Layout Container (Editorial Wide Layout) ── */}
        <div className="account-dashboard-layout">
          <div className="account-dashboard-grid account-hub">
            <div className="account-topbar">
              <span className="account-topbar-title">My account</span>
              <nav aria-label="Account navigation" className="account-tabs">
                {navLinks.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    href === "/account"
                      ? pathname === href
                      : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <form action={customerSignOut} className="account-signout">
                <SignOutButton />
              </form>
            </div>

            {/* ── Main Content Area ── */}
            <main
              id="account-content"
              tabIndex={-1}
              className="customer-box account-content flex-1 min-w-0 w-full focus:outline-none"
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </RevealFooterLayout>
  );
}
