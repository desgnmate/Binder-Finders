import Link from "next/link";
import { PageShell } from "../../../components/site/PageShell";
import { btnDark, headline, px, wrap } from "../../../components/site/ui";
import { JsonLd } from "../../../components/seo/JsonLd";
import { getCatalog } from "../../../lib/cms/catalog";
import { NOT_AS_DESCRIBED_DAYS } from "../../../lib/content/store-policies";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "How holds work",
  description:
    "Request a hold on vintage Pokémon cards, pay only after the store accepts, then get them shipped or picked up in Melbourne. Answers to common questions.",
  path: "/how-holds-work",
});

type Faq = { q: string; a: React.ReactNode; text: string };

function faqs(hours: number): { topic: string; items: Faq[] }[] {
  return [
    {
      topic: "Holds & payment",
      items: [
        {
          q: "Do I pay when I request a hold?",
          text: "No. Requesting a hold is free. You only pay after we accept, using the secure Stripe link we email you.",
          a: "No. Requesting a hold is free. You only pay after we accept, using the secure Stripe link we email you.",
        },
        {
          q: "When are the cards reserved for me?",
          text: `As soon as we accept your request. From then you have ${hours} hours to pay before the cards go back on sale.`,
          a: `As soon as we accept your request. From then you have ${hours} hours to pay before the cards go back on sale.`,
        },
        {
          q: "Can I cancel a hold?",
          text: "Yes, any time before you pay. Reply to our email or contact us with your request number.",
          a: (
            <>
              Yes, any time before you pay. Reply to our email or <Link href="/contact">contact us</Link> with your request number.
            </>
          ),
        },
        {
          q: "How do I pay?",
          text: "By card through Stripe's secure checkout. We never see or store your card number.",
          a: "By card through Stripe's secure checkout. We never see or store your card number.",
        },
      ],
    },
    {
      topic: "Condition & grading",
      items: [
        {
          q: "Are the photos of the actual card?",
          text: "Yes. Every listing uses flatbed scans of the exact card you'll receive.",
          a: "Yes. Every listing uses flatbed scans of the exact card you'll receive.",
        },
        {
          q: "What do Raw NM and Raw LP mean?",
          text: "Raw cards aren't graded. NM (near mint) shows little to no wear. LP (lightly played) has minor edge or corner wear you can see on the scan.",
          a: "Raw cards aren't graded. NM (near mint) shows little to no wear. LP (lightly played) has minor edge or corner wear you can see on the scan.",
        },
      ],
    },
    {
      topic: "Shipping & returns",
      items: [
        {
          q: "Can I pick up instead of having it posted?",
          text: "Yes. Choose pickup in your bag and we'll arrange a time in Melbourne by email after you pay.",
          a: "Yes. Choose pickup in your bag and we'll arrange a time in Melbourne by email after you pay.",
        },
        {
          q: "What if my card arrives damaged or not as described?",
          text: `Contact us within ${NOT_AS_DESCRIBED_DAYS} days of delivery with photos and we'll put it right.`,
          a: (
            <>
              Contact us within {NOT_AS_DESCRIBED_DAYS} days of delivery with photos and we&apos;ll put it right. See{" "}
              <Link href="/shipping-returns">shipping &amp; returns</Link>.
            </>
          ),
        },
      ],
    },
  ];
}

export default async function HowHoldsWorkPage() {
  const { settings } = await getCatalog();
  const hours = settings.holdDurationHours || 48;
  const groups = faqs(hours);
  const steps = [
    { title: "Request a hold", body: "Add cards to your bag and send the request. It's free and you can cancel any time.", color: "#fedd25" },
    { title: "We accept", body: "We check each card in hand, reserve it for you, and email a secure payment link.", color: "#d6eaff" },
    { title: `Pay within ${hours} h`, body: "Pay with Stripe. Unpaid holds expire and the cards go back in the binder.", color: "#ffd6e7" },
    { title: "Ship or pick up", body: "Tracked post or pickup in Melbourne. We email you when it's on the way.", color: "#9fdc8a" },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) =>
      g.items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.text } })),
    ),
  };

  return (
    <PageShell>
      <JsonLd data={faqJsonLd} />
      <section className="pb-12 pt-14">
        <div className={`${wrap} flex flex-col gap-8`}>
          <div data-motion="hero" className="flex max-w-[720px] flex-col gap-3.5">
            <span className={`${px} text-[#7b39ed]`}>Hold first, pay later</span>
            <h1 className={`${headline} m-0 text-[40px] leading-[1.05] md:text-[56px]`}>How holds work</h1>
            <p className="m-0 text-[19px] leading-relaxed">
              Vintage cards are one of a kind, so we don&apos;t take payment the moment you click. You ask for a hold, we
              check the card, and only then do you pay.
            </p>
          </div>
          <ol data-motion="pop" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2.5 rounded-[22px] border-[3px] border-ink-black bg-white p-[22px] shadow-[5px_5px_0_#1a1a1a]">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-ink-black font-retro text-xs"
                  style={{ background: step.color }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <b className="text-xl">{step.title}</b>
                <span className="text-[15px] leading-normal">{step.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-[72px]">
        <div className={`${wrap} flex flex-wrap items-start gap-10`}>
          <div data-motion="reveal" className="flex flex-[1_1_280px] flex-col gap-4 md:max-w-[360px]">
            <h2 className={`${headline} m-0 text-[30px] md:text-[34px]`}>Questions</h2>
            <p className="m-0 leading-normal">Can&apos;t find your answer? We read every message.</p>
            <Link href="/contact" className={`${btnDark} self-start`}>Contact us</Link>
          </div>
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
            {groups.map((group, gi) => (
              <div key={group.topic} data-motion="stagger" className="flex flex-col gap-3.5">
                <h3 className={`${px} m-0 text-[9px] ${gi ? "pt-3" : ""}`}>{group.topic}</h3>
                {group.items.map((item, i) => (
                  <details
                    key={item.q}
                    open={gi === 0 && i === 0}
                    className="group rounded-[18px] border-[3px] border-ink-black bg-white open:bg-pastel-yellow"
                  >
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] text-lg font-semibold [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-ink-black bg-brand-yellow font-bold after:content-['+'] group-open:after:content-['–']"
                      />
                    </summary>
                    <p className="m-0 px-5 pb-5 leading-relaxed [&_a]:font-semibold [&_a]:underline">{item.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
