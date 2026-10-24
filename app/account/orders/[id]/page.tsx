import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Check, ChevronRight, Clock } from "lucide-react";
import { sessionClient } from "../../../../lib/supabase/server";
import { stripePaymentsConfigured } from "../../../../lib/stripe";
import { CancelHoldButton } from "../../../../components/account/CancelHoldButton";
import { PayHoldButton } from "../../../../components/account/PayHoldButton";
import {
  daysLeft,
  formatDate,
  formatMoney,
  fulfilmentStatus,
  holdStatus,
  isClosedHold,
  paymentStatus,
  shortId,
} from "../../../../components/account/status";

type Step = { label: string; done: boolean };

// The five stops on the game-screen progress track.
function progressSteps(status: string, payment: string, fulfilment: string): Step[] {
  const packed = ["ready", "shipped", "delivered", "picked_up"].includes(fulfilment);
  const sent = ["shipped", "delivered", "picked_up"].includes(fulfilment);
  return [
    { label: "Requested", done: true },
    { label: "Reserved", done: ["accepted", "completed"].includes(status) },
    { label: "Paid", done: payment === "paid" },
    { label: "Packed", done: packed },
    { label: fulfilment === "picked_up" ? "Picked up" : "Shipped", done: sent },
  ];
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

  const status = holdStatus(data.status);
  const payment = paymentStatus(data.payment_status);
  const fulfilment = fulfilmentStatus(data.fulfillment_status);
  const closed = isClosedHold(data.status);
  const showTrack = !closed && data.payment_status !== "refunded";
  const steps = progressSteps(data.status, data.payment_status || "unpaid", data.fulfillment_status || "not_ready");
  const current = steps.findIndex((step) => !step.done);
  const showDeadline = data.status === "accepted" && !!data.expires_at;
  const deadlineSticker = showDeadline && canPay;

  let nextLine: React.ReactNode = null;
  if (data.status === "pending") {
    nextLine = "We're checking your cards. We'll email you once they're reserved.";
  } else if (data.status === "accepted" && data.payment_status === "pending") {
    nextLine = "Checkout is in progress. You can reopen it below; cancellation is available after it finishes or expires.";
  } else if (canPay && data.expires_at) {
    nextLine = <>Next: pay before <strong>{formatDate(data.expires_at)}</strong> and we&apos;ll pack your cards.</>;
  } else if (data.payment_status === "paid" && current === 3) {
    nextLine = "Payment received. We're packing your cards next.";
  } else if (current === 4) {
    nextLine = "Your cards are packed and nearly on their way.";
  } else if (current === -1) {
    nextLine = "All done. Enjoy your cards!";
  }

  return (
    <section className="ac-panel ac-panel--blue" aria-labelledby="request-heading">
      <nav className="ac-crumbs" aria-label="Breadcrumb">
        <Link href="/account/orders">Orders &amp; holds</Link>
        <ChevronRight size={14} strokeWidth={3} aria-hidden="true" />
        <span aria-current="page">Request {shortId(data.id)}</span>
      </nav>

      {query.payment === "success" && (
        <div className="ac-banner ac-banner--success" role="status">
          <span className="ac-banner__icon" aria-hidden="true">
            <Check size={18} strokeWidth={3} />
          </span>
          <div>
            <strong>Payment submitted</strong>
            Payment submitted. We&apos;ll update this request as soon as Stripe confirms it.
          </div>
        </div>
      )}
      {query.payment === "cancelled" && (
        <div className="ac-banner" role="status">
          <span className="ac-banner__icon" aria-hidden="true">
            <Clock size={18} strokeWidth={2.6} />
          </span>
          <div>
            <strong>Payment cancelled</strong>
            Payment was cancelled. Your hold is still active until its deadline.
          </div>
        </div>
      )}

      <header className="ac-head">
        <div className="ac-head__text">
          <span className="ac-px">Created {formatDate(data.created_at)}</span>
          <h1 id="request-heading">Request {shortId(data.id)}</h1>
        </div>
        <span className="ac-chip ac-chip--lg" data-tone={status.tone}>
          {data.status === "accepted" ? "Reserved for you" : status.label}
        </span>
      </header>

      {showTrack && (
        <div className="ac-screen ac-progress">
          <ol className="ac-track" aria-label="Request progress">
            {steps.map((step, index) => (
              <li
                key={step.label}
                data-state={step.done ? "done" : index === current ? "now" : "todo"}
                aria-current={index === current ? "step" : undefined}
              >
                <span className="ac-track__bar" aria-hidden="true" />
                <span className="ac-track__label">
                  {step.done ? "✓ " : index === current ? "▶ " : ""}
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          {current >= 0 && (
            <p className="ac-px ac-progress__step">
              Step {current + 1} of 5 · {steps[current].label}
            </p>
          )}
          {nextLine && <p>{nextLine}</p>}
        </div>
      )}

      <div className="ac-detail">
        <section className="ac-notebook ac-ticket" aria-labelledby="cards-heading">
          <div className="ac-rings" aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
          <div className="ac-notebook__body">
            <div className="ac-ticket__head">
              <h2 id="cards-heading">Cards on hold</h2>
              <span className="ac-px ac-muted">
                {items.length === 1 ? "1 card" : `${items.length} cards`}
              </span>
            </div>
            <ul>
              {items.map((item: { card_id: string; name: string; price_cents: number }) => (
                <li key={item.card_id}>
                  <span className="ac-sleeve" aria-hidden="true" />
                  <strong>{item.name}</strong>
                  <span>{formatMoney(data.currency, item.price_cents)}</span>
                </li>
              ))}
            </ul>
            <hr className="ac-divider" />
            <div className="ac-ticket__total">
              <span>Total</span>
              <span>{formatMoney(data.currency, total)}</span>
            </div>
          </div>
        </section>

        <section className="ac-card ac-pay" aria-labelledby="payment-heading">
          {deadlineSticker && data.expires_at && (
            <div className="ac-sticker" aria-hidden="true">
              <span className="ac-px">Hold ends</span>
              <strong>
                {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" }).format(new Date(data.expires_at))}
              </strong>
              <small>{daysLeft(data.expires_at) === 1 ? "1 day" : `${daysLeft(data.expires_at)} days`}</small>
            </div>
          )}
          <div className={`ac-pay__head${deadlineSticker ? " ac-pay__head--sticker" : ""}`}>
            <h2 id="payment-heading">Payment</h2>
            <span className="ac-chip" data-tone={payment.tone}>
              {data.payment_status === "paid" && <Check size={12} strokeWidth={3.4} aria-hidden="true" />}
              {payment.label}
            </span>
          </div>
          {data.payment_status === "paid" && (
            <div className="ac-row">
              <span className="ac-paid-stamp" aria-hidden="true">PAID</span>
              <p>{formatMoney(data.currency, total)} received.</p>
            </div>
          )}
          {data.payment_status === "refunded" && (
            <p>This payment was refunded to your card. Refunds can take 5–10 business days to appear.</p>
          )}
          {showDeadline && data.expires_at && (
            <p>
              Hold deadline: <strong>{formatDate(data.expires_at)}</strong>
            </p>
          )}
          {data.payment_failure_reason && (
            <p className="ac-note ac-note--error">
              <strong>Payment note:</strong> {data.payment_failure_reason}
            </p>
          )}
          {canPay && <PayHoldButton id={data.id} enabled={stripePaymentsConfigured()} />}
          <hr className="ac-divider" />
          <div className="ac-pay__row">
            <span>Fulfilment</span>
            <span className="ac-chip" data-tone={fulfilment.tone}>{fulfilment.label}</span>
          </div>
          {data.fulfillment_note && (
            <p className="ac-note">
              <strong>Fulfilment note:</strong> {data.fulfillment_note}
            </p>
          )}
          {canCancel && (
            <>
              <hr className="ac-divider" />
              <CancelHoldButton id={data.id} />
            </>
          )}
        </section>
      </div>

      <section className="ac-card ac-dots ac-history" aria-labelledby="history-heading">
        <div className="ac-history__intro">
          <span className="ac-px ac-muted">Trainer log</span>
          <h2 id="history-heading">Status history</h2>
          <Image src="/sprites/gen3/202.png" unoptimized alt="" width={96} height={96} aria-hidden="true" />
        </div>
        <ol className="ac-log">
          {history.map(
            (event: {
              id: number;
              to_status: string;
              note: string | null;
              created_at: string;
            }) => (
              <li key={event.id}>
                <span className="ac-log__node" data-tone={holdStatus(event.to_status).tone} aria-hidden="true" />
                <div className="ac-log__entry">
                  <span>
                    <strong>{holdStatus(event.to_status).label}</strong>
                    <time className="ac-px ac-muted" dateTime={event.created_at}>
                      {formatDate(event.created_at)}
                    </time>
                  </span>
                  {event.note && <p>{event.note}</p>}
                </div>
              </li>
            ),
          )}
        </ol>
      </section>
    </section>
  );
}
