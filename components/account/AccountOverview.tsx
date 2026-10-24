import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  MessageCircle,
  PackageOpen,
  ShoppingBag,
} from "lucide-react";

export type RecentHold = {
  id: string;
  status: string;
  currency: string;
  created_at: string;
  hold_request_items: { card_id: string; name: string; price_cents: number }[];
};

const labels: Record<string, string> = {
  pending: "Awaiting confirmation",
  accepted: "Reserved",
  completed: "Completed",
  rejected: "Not available",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function AccountOverview({
  name,
  email,
  holds,
  counts,
  ordersUnavailable,
  profileUnavailable,
}: {
  name: string;
  email: string;
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
  return (
    <div className="account-overview">
      <section className="collector-summary" aria-labelledby="welcome-heading">
        <header className="collector-welcome">
          <span className="collector-eyebrow">Your collector space</span>
          <h1 id="welcome-heading">Welcome back, {firstName}.</h1>
          <p>Your cards, requests, and next great finds. All in one place.</p>
          <Link href="/shop" className="collector-shop-link">
            Browse cards <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </header>
        <dl className="collector-metrics" aria-label="Your order summary">
          <div>
            <dt>Total requests</dt>
            <dd>
              {counts.total ?? "—"}
              <small>All-time activity</small>
            </dd>
          </div>
          <div>
            <dt>Open requests</dt>
            <dd>
              {counts.active ?? "—"}
              <small>Waiting or reserved</small>
            </dd>
          </div>
          <div>
            <dt>Completed orders</dt>
            <dd>
              {counts.completed ?? "—"}
              <small>Finished purchases</small>
            </dd>
          </div>
        </dl>
      </section>
      {Object.values(counts).some((v) => v === null) && (
        <p className="customer-message" role="alert">
          Some order totals are temporarily unavailable. Please try again later.
        </p>
      )}

      <section className="collector-orders" aria-labelledby="recent-heading">
        <div className="collector-section-heading">
          <div>
            <h2 id="recent-heading">Recent orders & holds</h2>
            <p>
              Check a request for its latest status and available next steps.
            </p>
          </div>
          <Link href="/account/orders">
            View all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {ordersUnavailable ? (
          <p className="customer-message" role="alert">
            Your recent requests are temporarily unavailable. Please try again
            later.
          </p>
        ) : holds.length === 0 ? (
          <div className="account-empty">
            <span className="account-empty-icon">
              <PackageOpen size={32} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h3>Your next find starts here</h3>
            <p>
              Once you request a card hold, you can follow its progress right
              here.
            </p>
            <Link href="/shop" className="account-button">
              Explore the cards <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="collector-order-columns" aria-hidden="true">
              <span>Cards / request</span>
              <span>Requested</span>
              <span>Status</span>
              <span>Total</span>
              <span />
            </div>
            <ul className="collector-order-list">
              {holds.map((hold) => (
                <li key={hold.id}>
                  <Link
                    href={`/account/orders/${hold.id}`}
                    className="collector-order-row"
                  >
                    <span className="collector-order-name">
                      <span className="collector-order-icon">
                        <ShoppingBag size={22} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>
                          {hold.hold_request_items[0]?.name ||
                            `Request ${hold.id.slice(0, 8).toUpperCase()}`}
                          {hold.hold_request_items.length > 1 &&
                            ` + ${hold.hold_request_items.length - 1} more`}
                        </strong>
                        <small>#{hold.id.slice(0, 8).toUpperCase()}</small>
                      </span>
                    </span>
                    <time dateTime={hold.created_at}>
                      {new Intl.DateTimeFormat("en-AU", {
                        dateStyle: "medium",
                        timeZone: "Australia/Melbourne",
                      }).format(new Date(hold.created_at))}
                    </time>
                    <span className="collector-order-state">
                      <span
                        className="customer-order-status"
                        data-status={hold.status}
                      >
                        {labels[hold.status] || hold.status}
                      </span>
                    </span>
                    <span className="collector-order-price">
                      {hold.currency}{" "}
                      {new Intl.NumberFormat("en-AU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(
                        hold.hold_request_items.reduce(
                          (sum, item) => sum + item.price_cents,
                          0,
                        ) / 100,
                      )}
                    </span>
                    <ArrowRight
                      className="collector-order-arrow"
                      size={18}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <details className="collector-guide">
          <summary>
            <span>How a hold becomes an order</span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Request a hold</strong>
                <p>Choose your cards and send the request.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Store confirms</strong>
                <p>We check availability and reserve the cards.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Pay securely</strong>
                <p>Stripe checkout opens in Orders after confirmation.</p>
              </div>
            </li>
          </ol>
        </details>
      </section>

      <div className="collector-utilities">
        <section
          className="collector-profile"
          aria-labelledby="details-heading"
        >
          <div className="collector-utility-top">
            <h2 id="details-heading">Your account</h2>
            <span className="account-verified">
              <Check size={13} aria-hidden="true" /> Email verified
            </span>
          </div>
          {profileUnavailable && (
            <p className="customer-message" role="alert">
              Your saved profile is temporarily unavailable.
            </p>
          )}
          <div className="collector-profile-body">
            <span className="collector-avatar" aria-hidden="true">
              {firstName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{name || "Collector"}</strong>
              <p>{email}</p>
            </div>
            <Link
              href="/account/profile"
              aria-label="Manage profile & security"
            >
              Manage profile <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section
          className="collector-support"
          aria-labelledby="support-heading"
        >
          <span className="collector-support-icon">
            <MessageCircle size={25} aria-hidden="true" />
          </span>
          <div>
            <h2 id="support-heading">A little help with your next find?</h2>
            <p>Ask us about condition, closer scans, or a card on hold.</p>
            <Link href="/#contact">
              Get in touch <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
