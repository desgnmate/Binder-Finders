import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Lock } from "lucide-react";
import { daysLeft, formatDate, formatMoney, holdStatus, paymentStatus, shortId } from "./status";

export type RecentHold = {
  id: string;
  status: string;
  currency: string;
  created_at: string;
  payment_status?: string | null;
  expires_at?: string | null;
  hold_request_items: { card_id: string; name: string; price_cents: number }[];
};

function holdName(hold: RecentHold) {
  const first = hold.hold_request_items[0]?.name || `Request ${shortId(hold.id)}`;
  const more = hold.hold_request_items.length - 1;
  return more > 0 ? `${first} + ${more} more` : first;
}

function holdTotal(hold: RecentHold) {
  return hold.hold_request_items.reduce((sum, item) => sum + item.price_cents, 0);
}

function CardSleeve({ count, size }: { count: number; size?: "lg" }) {
  return (
    <span className={`ac-sleeve${size ? ` ac-sleeve--${size}` : ""}`} aria-hidden="true">
      {count > 1 && <span className="ac-sleeve__count">{count}</span>}
    </span>
  );
}

export function AccountOverview({
  name,
  email,
  memberSince,
  holds,
  counts,
  ordersUnavailable,
  profileUnavailable,
}: {
  name: string;
  email: string;
  memberSince?: string;
  holds: RecentHold[];
  counts: {
    total: number | null;
    active: number | null;
    completed: number | null;
  };
  ordersUnavailable: boolean;
  profileUnavailable: boolean;
}) {
  const firstName = name.trim().split(/\s+/)[0] || "Collector";
  // The reserved hold still waiting on the customer, if any.
  const nextUp = holds.find(
    (hold) => hold.status === "accepted" && !["paid", "refunded"].includes(hold.payment_status || "unpaid"),
  );
  const awaiting = holds.find((hold) => hold.status === "pending");

  return (
    <div className="account-overview">
      <section className="ac-panel ac-panel--red" aria-labelledby="welcome-heading">
        <div className="ac-lights" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div className="ac-hub">
          <div className="ac-trainer ac-dots">
            <div className="ac-trainer__top">
              <span className="ac-px">Trainer card</span>
              {memberSince && (
                <span className="ac-px">
                  Since {new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "Australia/Melbourne" }).format(new Date(memberSince))}
                </span>
              )}
            </div>
            <div className="ac-trainer__id">
              <div className="ac-avatar" aria-hidden="true">
                <Image src="/trainer/walk-1.png" unoptimized alt="" width={104} height={104} />
              </div>
              <div className="ac-trainer__meta">
                <h1 id="welcome-heading">Welcome back, {firstName}.</h1>
                <p>
                  {email} ·{" "}
                  <span className="ac-verified">
                    <Check size={14} strokeWidth={3} aria-hidden="true" /> Email verified
                  </span>
                </p>
              </div>
            </div>
            {profileUnavailable && (
              <p className="customer-message" role="alert">
                Your saved profile is temporarily unavailable.
              </p>
            )}
            <dl className="ac-stats" aria-label="Your order summary">
              <div className="ac-stat">
                <dt className="ac-px">All requests</dt>
                <dd>{counts.total ?? "—"}</dd>
              </div>
              <div className="ac-stat">
                <dt className="ac-px">Open holds</dt>
                <dd>{counts.active ?? "—"}</dd>
              </div>
              <div className="ac-stat">
                <dt className="ac-px">Completed</dt>
                <dd>{counts.completed ?? "—"}</dd>
              </div>
            </dl>
            <div className="ac-trainer__links">
              <Link href="/shop" className="ac-btn ac-btn--sm ac-btn--yellow">
                Browse cards <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/account/profile" className="ac-link">
                Manage profile
              </Link>
            </div>
          </div>

          <section className="ac-screen ac-nextup" aria-labelledby="next-heading">
            {nextUp ? (
              <>
                <div className="ac-nextup__top">
                  <h2 id="next-heading" className="ac-px ac-eyebrow-light">▶ Next up</h2>
                  <span className="ac-chip" data-tone="reserved">Reserved for you</span>
                </div>
                <div className="ac-nextup__hold">
                  <CardSleeve count={nextUp.hold_request_items.length} size="lg" />
                  <div>
                    <p className="ac-nextup__title">{holdName(nextUp)}</p>
                    <p className="ac-px">Request {shortId(nextUp.id)}</p>
                    {nextUp.expires_at && (
                      <p className="ac-nextup__deadline">
                        Pay by {formatDate(nextUp.expires_at)} · {daysLeft(nextUp.expires_at) === 1 ? "1 day" : `${daysLeft(nextUp.expires_at)} days`} left
                      </p>
                    )}
                  </div>
                </div>
                <p>
                  {nextUp.payment_status === "pending"
                    ? "Your secure checkout is in progress. Open the request to finish paying."
                    : "The store has reserved your cards. Pay securely to lock them in before the deadline."}
                </p>
                <div className="ac-nextup__actions">
                  <Link href={`/account/orders/${nextUp.id}`} className="ac-btn ac-btn--yellow ac-btn--lg ac-btn--on-dark">
                    <Lock size={18} aria-hidden="true" />
                    {`Review & pay ${formatMoney(nextUp.currency, holdTotal(nextUp))}`}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 id="next-heading" className="ac-px ac-eyebrow-light">▶ Next up</h2>
                <p className="ac-nextup__title">
                  {awaiting ? "We're checking your request" : "Nothing waiting on you"}
                </p>
                <p>
                  {awaiting
                    ? "We'll email you as soon as your cards are reserved and ready to pay for."
                    : "When the store reserves a card for you, the next step shows up here."}
                </p>
                <div className="ac-nextup__actions">
                  <Link href="/shop" className="ac-btn ac-btn--outline-light">
                    Shop the binder <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      {Object.values(counts).some((v) => v === null) && (
        <p className="customer-message ac-section" role="alert">
          Some order totals are temporarily unavailable. Please try again later.
        </p>
      )}

      <section className="ac-panel ac-panel--carbon ac-section" aria-labelledby="recent-heading">
        <div className="ac-head">
          <div className="ac-head__text">
            <span className="ac-px ac-eyebrow-light">Your binder</span>
            <h2 id="recent-heading">Recent holds</h2>
          </div>
          <Link href="/account/orders" className="ac-btn ac-btn--yellow ac-btn--on-dark">
            View all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {ordersUnavailable ? (
          <p className="customer-message" role="alert">
            Your recent requests are temporarily unavailable. Please try again later.
          </p>
        ) : holds.length === 0 ? (
          <div className="ac-empty">
            <Image src="/sprites/gen3/25.png" unoptimized alt="" width={96} height={96} aria-hidden="true" />
            <h3>Your next find starts here</h3>
            <p>Once you request a card hold, you can follow its progress right here.</p>
            <Link href="/shop" className="ac-btn ac-btn--yellow ac-btn--on-dark">
              Explore the cards <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ul className="ac-holds" aria-label="Recent holds">
            {holds.map((hold) => {
              const status = holdStatus(hold.status);
              const payment = paymentStatus(hold.payment_status);
              return (
                <li key={hold.id}>
                  <Link href={`/account/orders/${hold.id}`} className="ac-card ac-hold">
                    <CardSleeve count={hold.hold_request_items.length} />
                    <span className="ac-hold__body">
                      <strong>{holdName(hold)}</strong>
                      <span className="ac-px ac-muted">
                        {shortId(hold.id)} · <time dateTime={hold.created_at}>{formatDate(hold.created_at)}</time>
                      </span>
                      <span className="ac-chips">
                        <span className="ac-chip" data-tone={status.tone}>{status.label}</span>
                        {hold.status === "accepted" && hold.payment_status && (
                          <span className="ac-chip" data-tone={payment.tone}>{payment.label}</span>
                        )}
                      </span>
                    </span>
                    <span className="ac-hold__price">{formatMoney(hold.currency, holdTotal(hold))}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="ac-lower ac-section">
        <div className="ac-notebook">
          <div className="ac-rings" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <details className="ac-notebook__body ac-guide" open>
            <summary>
              <span>How a hold becomes an order</span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <ol>
              <li>
                <span className="ac-num ac-px">01</span>
                <div>
                  <strong>Request a hold</strong>
                  <p>Choose your cards and send the request.</p>
                </div>
              </li>
              <li>
                <span className="ac-num ac-px">02</span>
                <div>
                  <strong>Store confirms</strong>
                  <p>We check availability and reserve the cards.</p>
                </div>
              </li>
              <li>
                <span className="ac-num ac-px">03</span>
                <div>
                  <strong>Pay securely</strong>
                  <p>Stripe checkout opens in Orders after confirmation.</p>
                </div>
              </li>
            </ol>
          </details>
        </div>
        <section className="ac-panel ac-panel--yellow ac-help" aria-labelledby="support-heading">
          <Image src="/sprites/gen3/54.png" unoptimized alt="" width={112} height={112} aria-hidden="true" />
          <h2 id="support-heading">Need a closer look?</h2>
          <p>Ask us about condition, closer scans, or a card on hold.</p>
          <Link href="/#contact" className="ac-btn ac-btn--ink">
            Get in touch <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
