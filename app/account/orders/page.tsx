import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { sessionClient } from "../../../lib/supabase/server";
import {
  formatDate,
  formatMoney,
  fulfilmentStatus,
  holdStatus,
  isClosedHold,
  paymentStatus,
  shortId,
} from "../../../components/account/status";

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

const views = {
  all: { label: "All", match: () => true },
  open: { label: "Open", match: (hold: CustomerHold) => ["pending", "accepted"].includes(hold.status) },
  completed: { label: "Completed", match: (hold: CustomerHold) => hold.status === "completed" },
  closed: { label: "Closed", match: (hold: CustomerHold) => isClosedHold(hold.status) },
} as const;
type View = keyof typeof views;

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
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
  const requested = (await searchParams)?.view;
  const view: View = requested && requested in views ? (requested as View) : "all";
  const shown = holds.filter(views[view].match);

  return (
    <section className="ac-panel ac-panel--carbon" aria-labelledby="orders-heading">
      <div className="ac-head">
        <div className="ac-head__text">
          <span className="ac-px ac-eyebrow-light">
            {holds.length === 1 ? "1 request" : `${holds.length} requests`} in your binder
          </span>
          <h1 id="orders-heading">Orders &amp; holds</h1>
          <p>Every card request made from your account, newest first.</p>
        </div>
        {!error && holds.length > 0 && (
          <nav aria-label="Filter requests" className="ac-filters">
            {(Object.keys(views) as View[]).map((key) => (
              <Link
                key={key}
                href={key === "all" ? "/account/orders" : `/account/orders?view=${key}`}
                className="ac-btn"
                aria-current={key === view ? "true" : undefined}
              >
                {views[key].label} · {holds.filter(views[key].match).length}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {error ? (
        <p className="customer-message" role="alert">
          Your order history is temporarily unavailable. Please try again later.
        </p>
      ) : holds.length === 0 ? (
        <div className="ac-empty">
          <Image src="/sprites/gen3/25.png" unoptimized alt="" width={96} height={96} aria-hidden="true" />
          <h2 className="ac-h">No requests yet</h2>
          <p>Your confirmed card holds will appear here.</p>
          <Link href="/shop" className="ac-btn ac-btn--yellow ac-btn--on-dark">
            Browse cards <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="ac-empty">
          <h2 className="ac-h">Nothing here yet</h2>
          <p>No {views[view].label.toLowerCase()} requests right now.</p>
          <Link href="/account/orders" className="ac-btn ac-btn--yellow ac-btn--on-dark">
            Show all requests
          </Link>
        </div>
      ) : (
        <ul className="ac-orders">
          {shown.map((hold) => {
            const total = hold.hold_request_items.reduce((sum, item) => sum + item.price_cents, 0);
            const status = holdStatus(hold.status);
            const payment = paymentStatus(hold.payment_status);
            const fulfilment = fulfilmentStatus(hold.fulfillment_status);
            const closed = isClosedHold(hold.status);
            const awaitingPayment =
              hold.status === "accepted" &&
              !!hold.expires_at &&
              hold.payment_status !== "paid" &&
              hold.payment_status !== "refunded";
            return (
              <li key={hold.id}>
                <article className={`ac-card ac-order${closed ? " ac-order--closed" : ""}`}>
                  <div className="ac-order__main">
                    <div className="ac-order__title">
                      <Link href={`/account/orders/${hold.id}`}>Request {shortId(hold.id)}</Link>
                      <span className="ac-chip" data-tone={status.tone}>{status.label}</span>
                      <time className="ac-px ac-order__date" dateTime={hold.created_at}>
                        {formatDate(hold.created_at)}
                      </time>
                    </div>
                    <ul className="ac-items">
                      {hold.hold_request_items.map((item) => (
                        <li key={item.card_id} className="ac-item">
                          <span className="ac-sleeve ac-sleeve--sm" aria-hidden="true" />
                          <span>
                            <strong>{item.name}</strong>
                            <small>{formatMoney(hold.currency, item.price_cents)}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {!closed && (
                      <div className="ac-chips" aria-label="Order workflow">
                        <span className="ac-chip" data-tone={payment.tone}>Payment · {payment.label.toLowerCase()}</span>
                        <span className="ac-chip" data-tone={fulfilment.tone}>Fulfilment · {fulfilment.label.toLowerCase()}</span>
                      </div>
                    )}
                    {hold.fulfillment_note && (
                      <p className="ac-note">
                        <strong>Fulfilment note:</strong> {hold.fulfillment_note}
                      </p>
                    )}
                  </div>
                  <div className="ac-order__side">
                    <span className="ac-px ac-muted">Total</span>
                    <span className="ac-order__total">{formatMoney(hold.currency, total)}</span>
                    {awaitingPayment && hold.expires_at && (
                      <span className="ac-deadline">
                        <Clock size={16} strokeWidth={2.4} aria-hidden="true" />
                        Hold deadline: {formatDate(hold.expires_at)}
                      </span>
                    )}
                    {hold.status === "pending" && (
                      <span className="ac-muted">We&apos;ll email you once it&apos;s reserved.</span>
                    )}
                    <Link
                      href={`/account/orders/${hold.id}`}
                      className={`ac-btn${awaitingPayment ? " ac-btn--yellow" : ""}`}
                      aria-label={`${awaitingPayment ? "Review and pay" : "View"} request ${shortId(hold.id)}`}
                    >
                      {awaitingPayment ? "Review & pay" : "View request"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
