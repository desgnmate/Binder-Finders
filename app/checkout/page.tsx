import { CheckoutMartClient } from "../../components/checkout/CheckoutMartClient";

interface CheckoutPageProps {
  searchParams: { card?: string };
}

export default function CheckoutPage({ searchParams }: CheckoutPageProps) {
  return <CheckoutMartClient initialCardId={searchParams.card} />;
}
