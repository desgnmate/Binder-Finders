import Link from "next/link";
import { PageShell } from "../../../components/site/PageShell";
import { btn, btnDark, btnWhite, box, chip, headline, px, wrap } from "../../../components/site/ui";
import { getCatalog } from "../../../lib/cms/catalog";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "About us",
  description:
    "BinderFinders is a small vintage Pokémon card desk in Melbourne. Every card is hand-inspected and flatbed scanned, front and back.",
  path: "/about",
});

const STEPS = [
  { title: "Hand-inspected", body: "Checked under light for scratches, whitening, creases and print lines.", color: "#fedd25" },
  { title: "Flatbed scanned", body: "Front and back of the exact card, so you can judge it yourself.", color: "#d6eaff" },
  { title: "Centering checked", body: "Borders are compared before listing, and noted when they matter.", color: "#ffd6e7" },
  { title: "Packed to survive", body: "Sleeved and top-loaded in a rigid mailer. Slabs get extra padding.", color: "#9fdc8a" },
];

const FAN = [
  { id: 252, color: "#9fdc8a", tilt: "-rotate-[10deg] translate-x-[30px] translate-y-[10px]" },
  { id: 255, color: "#ff9a6b", tilt: "relative z-10" },
  { id: 258, color: "#8cc7ff", tilt: "rotate-[10deg] -translate-x-[30px] translate-y-[10px]" },
];

export default async function AboutPage() {
  const { settings } = await getCatalog();
  const content = settings.content;
  return (
    <PageShell>
      <section className="py-14 md:py-16">
        <div className={`${wrap} flex flex-wrap items-center gap-12`}>
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-[18px]">
            <span className={`${px} text-[#7b39ed]`}>About BinderFinders</span>
            <h1 className={`${headline} m-0 text-[40px] leading-[1.05] md:text-[56px]`}>Real scans, real cards</h1>
            <p className="m-0 max-w-[560px] text-[19px] leading-relaxed">
              A small collector desk for vintage Pokémon in {content.location.split(",")[0]}. Every card comes with a real
              flatbed scan — no stock photos, no mystery conditions, no surprises.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop" className={`${btnDark} min-h-[52px]`}>Shop the binder</Link>
              <Link href="/how-holds-work" className={`${btnWhite} min-h-[52px]`}>How holds work</Link>
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_420px] justify-center py-6" aria-hidden="true">
            {FAN.map((card) => (
              <div
                key={card.id}
                className={`flex aspect-[63/88] w-[104px] items-center justify-center rounded-[14px] border-[3px] border-ink-black shadow-[6px_6px_0_#1a1a1a] sm:w-[150px] lg:w-[180px] ${card.tilt}`}
                style={{ background: card.color }}
              >
                <img src={`/sprites/gen3/${card.id}.png`} alt="" className="w-[70%] [image-rendering:pixelated]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-4 rounded-[40px] bg-ink-black py-16 text-white">
        <div className={`${wrap} flex flex-col gap-8`}>
          <h2 className={`${headline} m-0 text-[30px] md:text-[36px]`}>How we list cards</h2>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex flex-col gap-2.5 rounded-[22px] border-[3px] border-white p-[22px] text-ink-black"
                style={{ background: step.color }}
              >
                <span className={px}>{String(i + 1).padStart(2, "0")}</span>
                <b className="text-xl">{step.title}</b>
                <span className="text-[15px] leading-normal">{step.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-[72px]">
        <div className={`${wrap} flex flex-col gap-4 text-[17px] leading-[1.65]`}>
          <h2 className={`${headline} m-0 text-[28px] md:text-[32px]`}>Why we started</h2>
          <p className="m-0 max-w-[760px]">{content.aboutBody}</p>
          <p className="m-0 max-w-[760px]">
            Buying old cards online usually means blurry photos and vague grades. We list fewer cards, scan every one,
            and describe condition the way we&apos;d want it described to us.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className={chip}>{content.location}</span>
            <span className={chip}>WOTC era · 1999–2003</span>
            <span className={chip}>Graded &amp; raw</span>
          </div>
        </div>
      </section>

      <section className="pb-[72px]">
        <div className={wrap}>
          <div className={`${box} flex flex-wrap items-center justify-between gap-6 rounded-[32px] !bg-brand-blue p-8 text-white md:p-10`}>
            <div className="flex max-w-[620px] flex-col gap-2">
              <h2 className={`${headline} m-0 text-[26px] md:text-[30px]`}>Hunting a card?</h2>
              <p className="m-0 text-[17px]">
                Tell us the card, set and condition you want. If we have it or can find it, we&apos;ll let you know.
              </p>
            </div>
            <Link href="/contact?topic=wishlist" className={`${btn} min-h-[52px]`}>Send a wishlist</Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
