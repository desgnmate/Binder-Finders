import Link from "next/link";
import { SiteHeader } from "../components/site/SiteHeader";
import { btn, headline, px, wrap } from "../components/site/ui";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-black font-body text-white">
      <SiteHeader />
      <main className="flex flex-1 items-center py-16">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-12`}>
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <span className={`${px} text-brand-yellow`}>Error 404</span>
            <h1 className={`${headline} m-0 text-[48px] leading-none md:text-[64px]`}>Page not found</h1>
            <p className="m-0 max-w-[520px] text-[19px] leading-relaxed text-[#e6e6e6]">
              This page isn&apos;t in the binder. It may have sold, moved, or never existed. Try the shop or search for
              the card you&apos;re after.
            </p>
            <form action="/shop" role="search" className="flex max-w-[560px] flex-wrap gap-2.5">
              <label className="flex flex-[1_1_260px] flex-col gap-1.5">
                <span className={`${px} text-[9px] text-brand-yellow`}>Search the binder</span>
                <input
                  type="search"
                  name="q"
                  placeholder="Card name, set or number"
                  className="min-h-[52px] w-full rounded-[14px] border-[3px] border-white bg-white px-3.5 text-base text-ink-black"
                />
              </label>
              <button type="submit" className={`${btn} min-h-[52px] self-end`}>Search</button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop" className={`${btn} min-h-[52px]`}>Back to the shop</Link>
              <Link
                href="/contact"
                className={`${btn} min-h-[52px] !border-white !bg-transparent !text-white !shadow-[3px_3px_0_#fedd25] hover:!text-brand-yellow`}
              >
                Tell us what broke
              </Link>
            </div>
          </div>
          <div className="flex flex-[1_1_320px] justify-center" aria-hidden="true">
            <div className="flex aspect-[63/88] w-[240px] rotate-6 flex-col gap-2.5 rounded-[18px] border-4 border-white bg-brand-blue p-3.5 shadow-[10px_10px_0_#fedd25] md:w-[280px]">
              <div className="flex justify-between font-bold">
                <span>MissingPage</span>
                <span>404 HP</span>
              </div>
              <div className="flex flex-1 items-center justify-center rounded-[10px] border-[3px] border-ink-black bg-cream">
                <img src="/sprites/gen3/202.png" alt="" className="w-[66%] [image-rendering:pixelated]" />
              </div>
              <div className="text-center font-retro text-[8px]">It used Teleport. It worked.</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
