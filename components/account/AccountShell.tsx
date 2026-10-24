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
    <button type="submit" disabled={pending} className="ac-btn ac-btn--sm">
      <LogOut size={16} aria-hidden="true" />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

// Each section is a binder divider tab in one of the storefront's colours.
const navLinks = [
  { href: "/account", label: "Overview", short: "Overview", tone: "yellow", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders & holds", short: "Orders", tone: "blue", icon: Package },
  { href: "/account/profile", label: "Profile & security", short: "Profile", tone: "pink", icon: UserRound },
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
        <div className="ac">
          <HeroNav />
          <div className="ac-wrap">
            <div className="ac-auth">
              <div className="ac-auth__intro">
                <span className="ac-px">Collector accounts</span>
                <p className="ac-auth__title">Your holds, one binder.</p>
                <p>Sign in to follow your card holds, pay for reserved cards with Stripe and see when they ship.</p>
                <div className="ac-auth__sprites" aria-hidden="true">
                  <Image src="/sprites/gen3/54.png" unoptimized alt="" width={180} height={180} />
                  <Image src="/sprites/gen3/202.png" unoptimized alt="" width={200} height={200} />
                  <Image src="/sprites/gen3/194.png" unoptimized alt="" width={168} height={168} />
                </div>
              </div>
              <main className="ac-auth__card">
                <Image className="ac-auth__peek" src="/sprites/gen3/25.png" unoptimized alt="" width={104} height={104} aria-hidden="true" />
                <section className="ac-notebook ac-auth__paper customer-account">
                  <div className="ac-rings" aria-hidden="true">
                    <span /><span /><span /><span /><span /><span />
                  </div>
                  <div className="ac-notebook__body">
                    {children}
                    <p className="ac-back">
                      <Link href="/shop" className="ac-link">← Back to the shop</Link>
                    </p>
                  </div>
                </section>
              </main>
            </div>
          </div>
        </div>
      </RevealFooterLayout>
    );
  }

  return (
    <RevealFooterLayout footer={footer}>
      <div className="ac">
        <a className="ac-skip" href="#account-content">
          Skip to account content
        </a>
        <HeroNav />
        <div className="ac-wrap">
          <div className="ac-tabsbar">
            <nav aria-label="Account navigation" className="ac-tabs">
              {navLinks.map(({ href, label, short, tone, icon: Icon }) => {
                const isActive = href === "/account" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className="ac-tab"
                    data-tone={tone}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
                    <span className="ac-tab__long">{label}</span>
                    <span className="ac-tab__short">{short}</span>
                  </Link>
                );
              })}
            </nav>
            <form action={customerSignOut} className="ac-signout">
              <SignOutButton />
            </form>
          </div>
          <main id="account-content" tabIndex={-1} className="account-content focus:outline-none">
            {children}
          </main>
          <form action={customerSignOut} className="ac-mobile-signout">
            <SignOutButton />
          </form>
        </div>
      </div>
    </RevealFooterLayout>
  );
}
