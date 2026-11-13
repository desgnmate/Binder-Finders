import Link from "next/link";
import { PolicyLayout } from "../../../components/site/PolicyLayout";
import { getCatalog } from "../../../lib/cms/catalog";
import { NOT_AS_DESCRIBED_DAYS } from "../../../lib/content/store-policies";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Terms of sale",
  description: "How holds, payment, delivery and refunds work when you buy cards from BinderFinders.",
  path: "/terms",
});

export default async function TermsPage() {
  const { settings } = await getCatalog();
  const hours = settings.holdDurationHours || 48;
  const currency = settings.currency || "AUD";
  return (
    <PolicyLayout
      current="/terms"
      title="Terms of sale"
      summary={
        <>
          <b>The short version:</b> a hold request isn&apos;t a purchase. Once we accept, the cards are reserved for{" "}
          {hours} hours while you pay. Your rights under Australian Consumer Law always apply.
        </>
      }
      sections={[
        {
          id: "holds",
          title: "Hold requests",
          body: (
            <p>
              Sending a hold request asks us to reserve cards for you; it doesn&apos;t create a sale. We may accept or
              decline any request. When we accept, the cards are reserved for you and we email a payment link. If you
              don&apos;t pay within {hours} hours, the hold expires and the cards go back on sale.
            </p>
          ),
        },
        {
          id: "prices",
          title: "Prices & payment",
          body: (
            <p>
              Prices are in {currency}. The price you pay is the price shown when you sent the request; if a price
              changes before we accept, we&apos;ll ask you to send a new request. Payment is taken by card through
              Stripe. The sale is complete once payment succeeds.
            </p>
          ),
        },
        {
          id: "listings",
          title: "Listings & condition",
          body: (
            <p>
              Each listing shows scans of the actual card. Grades shown for slabs are the grading company&apos;s; our
              notes on raw cards are our honest opinion. If we&apos;ve made a mistake in a listing, we&apos;ll tell you
              before you pay, or refund you if you&apos;ve already paid.
            </p>
          ),
        },
        {
          id: "delivery",
          title: "Delivery & pickup",
          body: (
            <p>
              We post within Australia with tracking, or you can pick up in Melbourne by arrangement. Details are on our{" "}
              <Link href="/shipping-returns">shipping &amp; returns</Link> page.
            </p>
          ),
        },
        {
          id: "refunds",
          title: "Refunds & your rights",
          body: (
            <p>
              Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. If a card arrives
              damaged or isn&apos;t as described, contact us within {NOT_AS_DESCRIBED_DAYS} days of delivery and
              we&apos;ll refund or replace it.
            </p>
          ),
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of Victoria, Australia.</p>,
        },
      ]}
    />
  );
}
