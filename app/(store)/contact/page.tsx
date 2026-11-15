import { Mail, MapPin } from "lucide-react";
import { PageShell } from "../../../components/site/PageShell";
import { ContactForm } from "../../../components/site/ContactForm";
import { box, headline, px, wrap } from "../../../components/site/ui";
import { getCatalog } from "../../../lib/cms/catalog";
import { CONTACT_TOPICS, type ContactTopic } from "../../../lib/contact";
import { pageMetadata } from "../../../lib/seo";
import { sendContactMessage } from "./actions";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Ask BinderFinders for extra scans, corner photos, condition notes, a bundle quote or a card you're hunting for.",
  path: "/contact",
});

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; card?: string }>;
}) {
  const [{ settings, cards }, params] = await Promise.all([getCatalog(), searchParams]);
  const content = settings.content;
  const topic = CONTACT_TOPICS.some((t) => t.value === params.topic) ? (params.topic as ContactTopic) : "card";
  const card = params.card ? cards.find((c) => c.id === params.card) : undefined;
  const reference = card ? `${card.name} – ${card.set} ${card.number} (${card.condition})` : "";

  return (
    <PageShell background="#ffd6e7">
      <main className="flex-1 pb-20 pt-14">
        <div className={`${wrap} flex flex-wrap items-start gap-10`}>
          <section data-motion="hero" className="flex min-w-0 flex-[1_1_400px] flex-col gap-5">
            <span className={`${px} text-[#7b39ed]`}>Need a closer look?</span>
            <h1 className={`${headline} m-0 text-[40px] leading-[1.05] md:text-[56px]`}>Contact us</h1>
            <p className="m-0 max-w-[480px] text-lg leading-relaxed">{content.footerDescription}</p>
            <div className={`${box} flex flex-col gap-4 p-[22px]`}>
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-ink-black bg-brand-yellow">
                  <Mail size={20} aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className={`${px} text-[8px]`}>Email</span>
                  <a href={`mailto:${content.contactEmail}`} className="break-all text-[17px] font-semibold text-ink-black">
                    {content.contactEmail}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-ink-black bg-pastel-blue">
                  <MapPin size={20} aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className={`${px} text-[8px]`}>Based in</span>
                  <b className="text-[17px]">{content.location}</b>
                  <span className="text-sm">Pickup by arrangement</span>
                </div>
              </div>
            </div>
          </section>
          <ContactForm
            send={sendContactMessage}
            initialTopic={topic}
            initialReference={reference}
            fallbackEmail={content.contactEmail}
          />
        </div>
      </main>
    </PageShell>
  );
}
