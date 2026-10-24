import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sessionClient } from "../../../../lib/supabase/server";
import { stripePaymentsConfigured } from "../../../../lib/stripe";
import { CancelHoldButton } from "../../../../components/account/CancelHoldButton";
import { PayHoldButton } from "../../../../components/account/PayHoldButton";
import { ChevronRight } from "lucide-react";

const labels: Record<string, string> = {
  pending: "Awaiting confirmation",
  accepted: "Reserved",
  completed: "Completed",
  rejected: "Not available",
  cancelled: "Cancelled",
  expired: "Expired",
};
function pretty(value: string | null | undefined) {
  return (value || "pending").replaceAll("_", " ");
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export default async function CustomerOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(`/account/orders/${id}`)}`);
  if (!user.email_confirmed_at)
    redirect(`/account/verify?next=${encodeURIComponent(`/account/orders/${id}`)}`);
  const { data, error } = await db
    .from("hold_requests")
    .select(
      "id,status,currency,payment_status,payment_failure_reason,fulfillment_status,fulfillment_note,expires_at,created_at,hold_request_items(card_id,name,price_cents),hold_status_history(id,from_status,to_status,actor_kind,note,created_at)",
    )
    .eq("id", id)
    .eq("customer_user_id", user.id)
    .single();
  if (error || !data) notFound();
  const items = data.hold_request_items || [];
  const history = [...(data.hold_status_history || [])].sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const total = items.reduce(
    (sum: number, item: { price_cents: number }) => sum + item.price_cents,
    0,
  );
  const canCancel =
    ["pending", "accepted"].includes(data.status) &&
    !["paid", "refunded"].includes(data.payment_status || "unpaid") &&
    !(data.status === "accepted" && data.payment_status === "pending");
  const canPay =
    data.status === "accepted" &&
    ["unpaid", "pending", "failed"].includes(data.payment_status || "unpaid") &&
    !!data.expires_at &&
    new Date(data.expires_at).getTime() > Date.now() &&
    query.payment !== "success";

  return (
    <>
      {/* Breadcrumb */}
      <nav className="account-breadcrumb" aria-label="Breadcrumb">
        <Link href="/account/orders">Orders</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">Request {data.id.slice(0, 8).toUpperCase()}</span>
      </nav>

      <header className="account-page-header">
        <h1>Request {data.id.slice(0, 8).toUpperCase()}</h1>
        <p className="account-page-subtitle">Created {formatDate(data.created_at)}</p>
      </header>

      {query.payment === "success" && (
        <p className="customer-message" role="status">
          Payment submitted. We&apos;ll update this request as soon as Stripe confirms it.
        </p>
      )}
      {query.payment === "cancelled" && (
        <p className="customer-message" role="status">
          Payment was cancelled. Your hold is still active until its deadline.
        </p>
      )}

      <section className="customer-order-card">
        <div className="customer-order-card__topline">
          <strong>{labels[data.status] || data.status}</strong>
          <span>
            {data.currency} {(total / 100).toFixed(2)}
          </span>
        </div>
        <div className="customer-order-workflow">
          <span>Payment: {pretty(data.payment_status)}</span>
          <span>Fulfilment: {pretty(data.fulfillment_status)}</span>
        </div>
        {data.status === "accepted" && data.expires_at && (
          <p>Hold deadline: {formatDate(data.expires_at)}</p>
        )}
        {data.fulfillment_note && <p>Fulfilment note: {data.fulfillment_note}</p>}
        {data.payment_failure_reason && (
          <p>Payment note: {data.payment_failure_reason}</p>
        )}
        {data.status === "accepted" && data.payment_status === "pending" && (
          <p>Checkout is in progress. You can reopen it below; cancellation is available after it finishes or expires.</p>
        )}
        <ul>
          {items.map(
            (item: { card_id: string; name: string; price_cents: number }) => (
              <li key={item.card_id}>
                <span>{item.name}</span>
                <span>
                  {data.currency} {(item.price_cents / 100).toFixed(2)}
                </span>
              </li>
            ),
          )}
        </ul>
        {canPay && (
          <PayHoldButton id={data.id} enabled={stripePaymentsConfigured()} />
        )}
        {canCancel && <CancelHoldButton id={data.id} />}
      </section>

      <section className="customer-order-card">
        <h2>Status history</h2>
        <ol className="customer-timeline">
          {history.map(
            (event: {
              id: number;
              to_status: string;
              note: string | null;
              created_at: string;
            }) => (
              <li key={event.id}>
                <strong>{labels[event.to_status] || event.to_status}</strong>
                <small>{formatDate(event.created_at)}</small>
                {event.note && <p>{event.note}</p>}
              </li>
            ),
          )}
        </ol>
      </section>
    </>
  );
}
