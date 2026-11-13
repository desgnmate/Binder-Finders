import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "./PageShell";
import { headline, px, wrap } from "./ui";
import { POLICY_UPDATED } from "../../lib/content/store-policies";

export type PolicySection = { id: string; title: string; body: ReactNode };

const TABS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of sale" },
  { href: "/shipping-returns", label: "Shipping & returns" },
];

/** Shared layout for the privacy, terms and shipping & returns pages. */
export function PolicyLayout({
  current,
  title,
  intro,
  summary,
  sections,
  aside,
}: {
  current: string;
  title: string;
  intro?: ReactNode;
  summary?: ReactNode;
  sections: PolicySection[];
  aside?: ReactNode;
}) {
  return (
    <PageShell compactFooter>
      <section className="pb-8 pt-14">
        <div className={`${wrap} flex flex-col gap-[18px]`}>
          <nav aria-label="Policies" className="flex flex-wrap gap-2.5">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.href === current ? "page" : undefined}
                className="inline-flex min-h-[44px] items-center rounded-full border-[3px] border-ink-black bg-white px-[18px] font-semibold text-ink-black no-underline aria-[current=page]:bg-ink-black aria-[current=page]:text-white"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <h1 className={`${headline} m-0 text-[40px] leading-[1.05] md:text-[52px]`}>{title}</h1>
          <p className="m-0 text-[17px]">Last updated {POLICY_UPDATED}</p>
          {intro && <p className="m-0 max-w-[720px] text-[19px] leading-relaxed">{intro}</p>}
          {summary && (
            <div className="max-w-[820px] rounded-[18px] border-[3px] border-ink-black bg-pastel-yellow px-5 py-[18px] leading-relaxed">
              {summary}
            </div>
          )}
        </div>
      </section>
      <main className="flex-1 pb-20">
        <div className={`${wrap} flex flex-wrap items-start gap-12`}>
          <nav aria-label="Sections" className="flex w-full flex-col md:w-auto md:max-w-[280px] md:flex-[1_1_240px]">
            <span className={`${px} pb-2 text-[9px]`}>On this page</span>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex gap-2.5 border-b-2 border-dashed border-ink-black py-2 font-medium text-ink-black no-underline hover:text-brand-blue"
              >
                <span className="pt-1 font-retro text-[9px] text-[#7b39ed]">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            ))}
            {aside}
          </nav>
          <article className="flex min-w-0 max-w-[760px] flex-[999_1_560px] flex-col gap-3.5 text-[17px] leading-[1.7] [&_a]:font-semibold [&_a]:text-ink-black [&_a]:underline [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-[22px] [&_p]:m-0">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-3.5">
                <h2 className={`${headline} mt-3.5 flex items-baseline gap-3.5 text-2xl first:mt-0`}>
                  <span className="font-retro text-[11px] text-[#7b39ed]">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
      </main>
    </PageShell>
  );
}
