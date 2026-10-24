import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionClient } from "../../../lib/supabase/server";

type HoldItem = {
  card_id: string;
  name: string;
  price_cents: number;
};

type CustomerHold = {
  id: string;
  status: "pending" | "accepted" | "completed" | "rejected" | "cancelled" | "expired";
  currency: string;
  expires_at?: string | null;
  fulfillment_note?: string | null;
  payment_status?: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  fulfillment_status?:
    | "not_ready"
    | "ready"
    | "shipped"
    | "delivered"
    | "picked_up"
    | "cancelled";
  created_at: string;
  hold_request_items: HoldItem[];
};

const statusLabel: Record<CustomerHold["status"], string> = {
  pending: "Awaiting confirmation",
  accepted: "Reserved",
  completed: "Completed",
  rejected: "Not available",
  cancelled: "Cancelled",
  expired: "Expired",
};

function workflowLabel(value: string | undefined, fallback: string) {
  return (value || fallback).replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export default async function CustomerOrdersPage() {
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/account/login?next=/account/orders");
  if (!user.email_confirmed_at) redirect("/account/verify?next=/account/orders");

  const { data, error } = await db
    .from("hold_requests")
    .select(
      "id,status,currency,payment_status,fulfillment_status,fulfillment_note,expires_at,created_at,hold_request_items(card_id,name,price_cents)",
    )
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const holds = (data || []) as CustomerHold[];

  return (
    <>
      <header className="account-page-header">
        <h1>Order history</h1>
        <p className="account-page-subtitle">
          Every card request made from your account, all in one place.
        </p>
      </header>

      {error ? (
        <p className="customer-message" role="alert">
          Your order history is temporarily unavailable. Please try again later.
        </p>
      ) : holds.length === 0 ? (
        <section className="customer-empty-state">
          <h2>No requests yet</h2>
          <p>Your confirmed card holds will appear here.</p>
          <Link href="/shop">Browse cards</Link>
        </section>
      ) : (
        <div className="customer-order-list">
          {holds.map((hold) => {
            const total = hold.hold_request_items.reduce(
              (sum, item) => sum + item.price_cents,
              0,
            );
            return (
              <article className="customer-order-card" key={hold.id}>
                <div className="customer-order-card__topline">
                  <div>
                    <Link href={`/account/orders/${hold.id}`}>
                      <strong>Request {hold.id.slice(0, 8).toUpperCase()}</strong>
                    </Link>
                    <small>{formatDate(hold.created_at)}</small>
                  </div>
                  <span className="customer-order-status" data-status={hold.status}>
                    {statusLabel[hold.status]}
                  </span>
                </div>
                <div className="customer-order-workflow" aria-label="Order workflow">
                  <span data-status={hold.payment_status || "unpaid"}>
                    Payment: {workflowLabel(hold.payment_status, "unpaid")}
                  </span>
                  <span data-status={hold.fulfillment_status || "not_ready"}>
                    Fulfilment: {workflowLabel(hold.fulfillment_status, "not ready")}
                  </span>
                </div>
                {hold.fulfillment_note && <p>Fulfilment note: {hold.fulfillment_note}</p>}
                {hold.status === "accepted" &&
                  hold.expires_at &&
                  hold.payment_status !== "paid" && (
                    <p>Hold deadline: {formatDate(hold.expires_at)}</p>
                  )}
                <ul>
                  {hold.hold_request_items.map((item) => (
                    <li key={item.card_id}>
                      <span>{item.name}</span>
                      <span>
                        {hold.currency} {(item.price_cents / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="customer-order-total">
                  Total: {hold.currency} {(total / 100).toFixed(2)}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
