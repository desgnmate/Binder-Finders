import Link from "next/link";
import { PolicyLayout } from "../../../components/site/PolicyLayout";
import { getCatalog } from "../../../lib/cms/catalog";
import { pageMetadata } from "../../../lib/seo";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description: "What personal information BinderFinders collects, how it's used, who it's shared with and your rights.",
  path: "/privacy",
});

export default async function PrivacyPage() {
  const { settings } = await getCatalog();
  const email = settings.content.contactEmail;
  return (
    <PolicyLayout
      current="/privacy"
      title="Privacy policy"
      summary={
        <>
          <b>The short version:</b> we collect only what we need to hold, sell and send your cards. We never sell your
          data. Card payments are handled by Stripe — we never see your card number.
        </>
      }
      sections={[
        {
          id: "collect",
          title: "What we collect",
          body: (
            <ul>
              <li><b>Account details:</b> your name, email address and password, stored securely by our login provider.</li>
              <li><b>Hold and order details:</b> the cards you request, notes you send, and your delivery choice and address.</li>
              <li><b>Payment status:</b> whether a payment succeeded, from Stripe. Never your full card details.</li>
              <li><b>Messages</b> you send us by email or through the contact form.</li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <p>
              To process holds and orders, send order emails, ship or arrange pickup, answer your questions, and keep the
              shop secure. We only send marketing emails if you ask for them.
            </p>
          ),
        },
        {
          id: "share",
          title: "Who we share it with",
          body: (
            <p>
              Only the services that run the shop: Stripe (payments), Supabase (accounts and orders), Resend (order
              emails), Vercel (website hosting) and the postal service that delivers your parcel. Some of these store
              data outside Australia.
            </p>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: <p>We use cookies that keep you signed in, and your browser remembers what&apos;s in your bag.</p>,
        },
        {
          id: "keep",
          title: "How long we keep it",
          body: (
            <p>
              We keep order records for as long as Australian tax law requires. You can ask us to delete your account at
              any time.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <p>
              Under the Australian Privacy Principles you can ask to see, correct or delete the personal information we
              hold about you. If you&apos;re unhappy with our response, you can contact the Office of the Australian
              Information Commissioner (OAIC).
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact us",
          body: (
            <p>
              Email <a href={`mailto:${email}`}>{email}</a> or use the <Link href="/contact">contact form</Link>.
              BinderFinders, {settings.content.location}.
            </p>
          ),
        },
      ]}
    />
  );
}
