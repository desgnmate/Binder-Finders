import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock, RotateCcw, Truck } from "lucide-react";
import { PageShell } from "../../../../components/site/PageShell";
import { CardActions, CardScans } from "../../../../components/site/CardPageClient";
import { JsonLd } from "../../../../components/seo/JsonLd";
import { TYPE_COLORS, box, btnWhite, chip, headline, px, wrap } from "../../../../components/site/ui";
import { getCatalog } from "../../../../lib/cms/catalog";
import { formatPrice, isCardAvailable } from "../../../../lib/data";
import { breadcrumbJsonLd, cardMetadata, cardPath, cardTitle, productJsonLd } from "../../../../lib/seo";

type Props = { params: Promise<{ id: string }> };

function decodeId(id: string) {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, { cards, settings }] = await Promise.all([params, getCatalog()]);
  const card = cards.find((c) => c.id === decodeId(id));
  if (!card) return { title: "Card not found", robots: { index: false, follow: true } };
  return cardMetadata(card, settings.currency);
}

function stockLabel(availability?: string) {
  if (availability === "sold") return { text: "Sold", color: "#e6e6e6" };
  if (availability === "reserved") return { text: "On hold", color: "#fff3b8" };
  if (availability === "unavailable") return { text: "Unavailable", color: "#e6e6e6" };
  return { text: "In stock", color: "#9fdc8a" };
}

export default async function CardPage({ params }: Props) {
  const [{ id }, { cards, settings }] = await Promise.all([params, getCatalog()]);
  const card = cards.find((c) => c.id === decodeId(id));
  if (!card) notFound();

  const money = (n: number) => formatPrice(n, settings.currency ? `${settings.currency} ` : "$");
  const face = TYPE_COLORS[card.type] || "#f1efe6";
  const stock = stockLabel(card.availability);
  const sameSet = cards.filter((c) => c.id !== card.id && c.set === card.set && isCardAvailable(c));
  const more = (sameSet.length ? sameSet : cards.filter((c) => c.id !== card.id && isCardAvailable(c))).slice(0, 4);
  const specs = [
    ["Condition", card.condition],
    ["Rarity", card.rarity],
    ["Set", card.set],
    ["Number", card.number],
    ["Year", String(card.year)],
    ["Type", card.type],
  ];

  return (
    <PageShell>
      <JsonLd
        data={[
          productJsonLd(card, settings.currency),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: cardTitle(card), path: cardPath(card.id) },
          ]),
        ]}
      />
      <main className="flex-1 pb-16 pt-7">
        <div className={`${wrap} flex flex-col gap-7`}>
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap gap-2 text-sm font-medium">
              <li><Link href="/" className="text-ink-black">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/shop" className="text-ink-black">Shop</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{card.name} – {card.set} {card.number}</li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-start gap-10">
            <CardScans card={card} faceColor={face} />

            <section data-motion="hero" className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                <span className={chip} style={{ background: face }}>{card.type}</span>
                <span className={chip}>{card.set} · {card.year}</span>
                <span className={chip} style={{ background: stock.color }}>{stock.text}</span>
              </div>
              <h1 className={`${headline} m-0 text-[38px] leading-[1.05] md:text-[52px]`}>{card.name}</h1>
              <p className="m-0 text-[17px] text-ink-black/75">{card.set} · {card.number} · {card.rarity}</p>

              <div className={`${box} flex flex-col gap-[18px] !bg-brand-yellow p-6`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className={`${px} text-[9px]`}>Price</span>
                    <span className={`${headline} text-[34px] md:text-[40px]`}>{money(card.price)}</span>
                  </div>
                  <span className={`${chip} min-h-[32px] text-sm`}>{card.condition}</span>
                </div>
                <CardActions card={card} />
                <p className="m-0 text-sm leading-normal">
                  Send a hold request and we reserve the card once we accept. You only pay after that —{" "}
                  <Link href="/how-holds-work" className="font-semibold text-ink-black">how holds work</Link>.
                </p>
              </div>

              <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1 rounded-[14px] border-2 border-ink-black bg-cream p-3.5">
                    <dt className={`${px} text-[8px]`}>{label}</dt>
                    <dd className="m-0 text-[17px] font-bold">{value}</dd>
                  </div>
                ))}
              </dl>

              {card.description?.trim() && (
                <div className="flex flex-col gap-2.5">
                  <h2 className={`${headline} m-0 text-[22px]`}>Condition notes</h2>
                  <p className="m-0 leading-relaxed">{card.description}</p>
                </div>
              )}

              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[18px] border-[3px] border-ink-black bg-white p-0">
                <li className="flex items-center gap-3.5 border-b-2 border-ink-black px-[18px] py-3.5 text-[15px]">
                  <Truck size={22} aria-hidden="true" className="shrink-0" />
                  <span><b>Tracked post</b> from Melbourne, or pickup. <Link href="/shipping-returns" className="text-ink-black">Delivery options</Link></span>
                </li>
                <li className="flex items-center gap-3.5 border-b-2 border-ink-black px-[18px] py-3.5 text-[15px]">
                  <Lock size={22} aria-hidden="true" className="shrink-0" />
                  <span><b>Secure payment with Stripe</b> after your hold is accepted.</span>
                </li>
                <li className="flex items-center gap-3.5 px-[18px] py-3.5 text-[15px]">
                  <RotateCcw size={22} aria-hidden="true" className="shrink-0" />
                  <span><b>Not as described?</b> We make it right. <Link href="/shipping-returns#returns" className="text-ink-black">Returns</Link></span>
                </li>
              </ul>
            </section>
          </div>

          {more.length > 0 && (
            <section className="flex flex-col gap-5 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={`${headline} m-0 text-[26px] md:text-[28px]`}>
                  {sameSet.length ? `More from ${card.set}` : "More cards"}
                </h2>
                <Link href="/shop" className={btnWhite}>See all</Link>
              </div>
              <ul data-motion="stagger" className="m-0 grid list-none grid-cols-2 gap-6 p-0 md:grid-cols-4">
                {more.map((c) => (
                  <li key={c.id}>
                    <Link href={cardPath(c.id)} className="flex flex-col gap-2.5 text-ink-black no-underline">
                      <img
                        src={c.imageUrl}
                        alt={`${c.name} card`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="aspect-[63/88] w-full rounded-[14px] border-[3px] border-ink-black object-cover"
                        style={{ background: TYPE_COLORS[c.type] || "#f1efe6" }}
                      />
                      <span className="flex justify-between gap-2 font-bold">
                        <span>{c.name}</span>
                        <span className="whitespace-nowrap">{money(c.price)}</span>
                      </span>
                      <span className="text-[13px] text-ink-black/75">{c.condition}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </PageShell>
  );
}
