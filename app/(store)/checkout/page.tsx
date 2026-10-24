import { CheckoutMartClient } from "../../../components/checkout/CheckoutMartClient";
import { configured, sessionClient } from "../../../lib/supabase/server";

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
  return <CheckoutMartClient initialCardId={params.card} customer={customer} />;
}
