import Link from "next/link";
import { PolicyLayout } from "../../../components/site/PolicyLayout";
import { btnDark } from "../../../components/site/ui";
import {
  DISPATCH_BUSINESS_DAYS,
  LOST_PARCEL_BUSINESS_DAYS,
  NOT_AS_DESCRIBED_DAYS,
} from "../../../lib/content/store-policies";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Shipping & returns",
  description:
    "How BinderFinders packs and posts vintage Pokémon cards from Melbourne, pickup options, and what happens if a card isn't right.",
  path: "/shipping-returns",
});

const SERVICES = [
  { service: "Tracked post", bestFor: "Raw cards", arrives: "Australia-wide, with tracking" },
  { service: "Tracked & insured parcel", bestFor: "Graded slabs and larger orders", arrives: "Australia-wide, with tracking" },
  { service: "Pickup in Melbourne", bestFor: "Locals", arrives: "Free, by arrangement" },
];

export default function ShippingReturnsPage() {
  return (
    <PolicyLayout
      current="/shipping-returns"
      title="Shipping & returns"
      intro="Every card leaves Melbourne sleeved, top-loaded and tracked. If something isn't right when it arrives, we'll fix it."
      aside={<Link href="/contact" className={`${btnDark} mt-4 self-start`}>Ask a question</Link>}
      sections={[
        {
          id: "delivery",
          title: "Delivery options",
          body: (
            <>
              <p>
                Choose how you want your cards when you send a hold request. Orders are posted within{" "}
                {DISPATCH_BUSINESS_DAYS} business days of payment, and you get the tracking number by email.
              </p>
              <div className="overflow-x-auto rounded-[18px] border-[3px] border-ink-black bg-white shadow-[5px_5px_0_#1a1a1a]">
                <table className="w-full min-w-[520px] border-separate border-spacing-0 text-base">
                  <thead>
                    <tr>
                      {["Service", "Best for", "Details"].map((h) => (
                        <th key={h} scope="col" className="border-b-2 border-ink-black bg-brand-yellow px-4 py-3.5 text-left font-retro text-[9px] font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SERVICES.map((row, i) => (
                      <tr key={row.service}>
                        {[row.service, row.bestFor, row.arrives].map((cell, j) => (
                          <td key={j} className={`px-4 py-3.5 ${i < SERVICES.length - 1 ? "border-b-2 border-ink-black" : ""}`}>
                            {j === 0 ? <b>{cell}</b> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[15px]">We&apos;ll confirm postage with you by email when we accept your hold.</p>
            </>
          ),
        },
        {
          id: "packing",
          title: "How we pack",
          body: (
            <ul>
              <li>Raw cards: sleeve, top loader and a rigid card mailer.</li>
              <li>Graded slabs: slab sleeve, bubble wrap and a padded box.</li>
            </ul>
          ),
        },
        {
          id: "pickup",
          title: "Pickup",
          body: <p>Choose pickup in your bag. Once you&apos;ve paid, we email you to arrange a time and place in Melbourne.</p>,
        },
        {
          id: "returns",
          title: "Returns & refunds",
          body: (
            <>
              <div className="rounded-[24px] border-[3px] border-ink-black bg-pastel-blue p-[22px] text-base shadow-[6px_6px_0_#1a1a1a]">
                <b className="text-lg">Your consumer rights</b>
                <p className="mt-2">
                  Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. You&apos;re
                  entitled to a replacement or refund for a major failure, such as a card that isn&apos;t as described.
                </p>
              </div>
              <p>
                <b>Not as described:</b> if a card doesn&apos;t match its listing — wrong card, condition worse than the
                scans show, or a damaged slab — email us within {NOT_AS_DESCRIBED_DAYS} days of delivery with photos.
                We&apos;ll refund in full, including postage, or replace it if we can.
              </p>
              <p>
                <b>Change of mind:</b> each card is one of a kind, so please check the scans and ask questions before you
                pay. Contact us if you change your mind and we&apos;ll do our best to help.
              </p>
              <p>
                <b>How refunds are paid:</b> back to your original payment method through Stripe, usually within 5–10
                business days.
              </p>
            </>
          ),
        },
        {
          id: "lost",
          title: "Damaged or lost",
          body: (
            <p>
              If tracking shows no movement for {LOST_PARCEL_BUSINESS_DAYS} business days, or your parcel arrives
              damaged, <Link href="/contact?topic=order">contact us</Link> and we&apos;ll sort it out.
            </p>
          ),
        },
      ]}
    />
  );
}
