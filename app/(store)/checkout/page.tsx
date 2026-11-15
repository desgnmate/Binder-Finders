import type Stripe from "stripe";
import { CheckoutMartClient } from "../../../components/checkout/CheckoutMartClient";
import { PageShell } from "../../../components/site/PageShell";
import {
  configured,
  serviceClient,
  sessionClient,
} from "../../../lib/supabase/server";
import { stripeClient } from "../../../lib/stripe";

// Each visitor's checkout is different; it has nothing to show in search.
export const metadata = {
  title: "Your bag",
  robots: { index: false, follow: true },
};

type GuestPaymentReturn = {
  state: "paid" | "cancelled" | "pending" | "invalid";
  orderId: string | null;
};

interface CheckoutPageProps {
  searchParams: Promise<{
    card?: string;
    payment?: string;
    guest_order?: string;
    session_id?: string;
  }>;
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}

async function verifyGuestPaymentReturn(
  params: Awaited<CheckoutPageProps["searchParams"]>,
): Promise<GuestPaymentReturn | null> {
  if (params.payment === "cancelled") {
    return {
      state: "cancelled",
      orderId: params.guest_order || null,
    };
  }

  if (params.payment !== "success") return null;

  const orderId = params.guest_order?.trim();
  const sessionId = params.session_id?.trim();

  if (!orderId || !sessionId) {
    return { state: "invalid", orderId: orderId || null };
  }

  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const attemptId =
      session.metadata?.guest_payment_attempt_id?.trim() || "";

    const validGuestSession =
      session.metadata?.checkout_kind === "guest" &&
      session.metadata?.guest_order_id === orderId &&
      session.client_reference_id === orderId &&
      !!attemptId;

    if (!validGuestSession) {
      return { state: "invalid", orderId };
    }

    if (
      session.status !== "complete" ||
      session.payment_status !== "paid"
    ) {
      return { state: "pending", orderId };
    }

    const db = serviceClient();

    const { error } = await db.rpc(
      "cms_record_guest_stripe_webhook",
      {
        p_event_id: `guest_return_${session.id}_success`,
        p_event_type: "guest.return.success",
        p_attempt_id: attemptId,
        p_session_id: session.id,
        p_payment_intent_id: paymentIntentId(session),
        p_result: "success",
        p_reason: null,
      },
    );

    if (error) {
      console.error(
        "Guest payment return reconciliation failed",
        orderId,
        error,
      );

      return { state: "pending", orderId };
    }


    return { state: "paid", orderId };
  } catch (error) {
    console.error("Guest payment return verification failed", error);

    return {
      state: "pending",
      orderId,
    };
  }
}

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;

  const guestPaymentReturn =
    await verifyGuestPaymentReturn(params);

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
      <CheckoutMartClient
        initialCardId={params.card}
        customer={customer}
        guestPaymentReturn={guestPaymentReturn}
      />
    </PageShell>
  );
}
