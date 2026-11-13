import { CheckoutMartClient } from "../../../components/checkout/CheckoutMartClient";
import { PageShell } from "../../../components/site/PageShell";
import { configured, sessionClient } from "../../../lib/supabase/server";

// Each visitor's checkout is different; it has nothing to show in search.
export const metadata = { title: "Your bag", robots: { index: false, follow: true } };

interface CheckoutPageProps {
  searchParams: Promise<{ card?: string }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  let customer: { email: string; name: string } | null = null;
  if (configured()) {
    const db = await sessionClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user?.email_confirmed_at && user.email) {
      customer = {
        email: user.email,
        name: String(user.user_metadata.name || ""),
      };
    }
  }
  return (
    <PageShell compactFooter>
      <CheckoutMartClient initialCardId={params.card} customer={customer} />
    </PageShell>
  );
}
