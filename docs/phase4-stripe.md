# Phase 4 — Stripe payments

Phase 4 adds hosted Stripe Checkout for accepted customer holds. Customers can
pay from `/account/orders/<request-id>` after an administrator accepts the
request. Stripe is the payment source of truth; the webhook updates the hold,
while staff still control fulfilment and final sale completion from the CMS.

## Implemented

- `payment_attempts` stores server-created attempts, amount snapshots, Stripe
  Checkout session IDs, payment intent IDs, status, and failure reasons.
- `stripe_webhook_events` makes webhook processing idempotent.
- The server builds Checkout line items from the accepted hold's database
  snapshot. Prices and totals are never accepted from the browser.
- Customer ownership, accepted status, hold deadline, verified email, and
  payment state are checked before a Checkout session can be created.
- Repeated clicks reuse the same open session. Failed or expired sessions can
  be retried safely.
- Checkout expires no later than the hold deadline. While Checkout is active,
  customer/admin cancellation and automatic hold expiry cannot release its
  reserved cards. The scheduled job checks Stripe before releasing an overdue
  hold; uncertain payments stay reserved for another reconciliation attempt.
- Signed Stripe webhooks handle completed, asynchronous success/failure, and
  expired Checkout sessions.
- A paid hold is not automatically marked fulfilled or sold. Staff must still
  prepare fulfilment and complete the sale through the existing CMS workflow.
- Without both Stripe server variables, the customer payment button remains
  disabled and the API refuses to create attempts.
- The CMS Settings screen reports whether both Stripe server variables are
  present without exposing their values.

## Apply the database migration

Run this migration once in the authenticated Supabase SQL editor, after the
existing Phase 3 migrations:

```text
supabase/migrations/202609270001_phase4_stripe_payments.sql
```

The follow-up safety migration is also required before live checkout:

```text
supabase/migrations/202609280001_phase4_checkout_safety.sql
```

A third migration fixes payment retries and must be applied before live
checkout (it has **not** been applied to production yet):

```text
supabase/migrations/202610240001_phase4_payment_retry_fix.sql
```

It makes a reused client key return its still-open Checkout session instead
of failing it (which could leave two payable sessions for one hold), refuses to
reuse a finished attempt's key with Stripe, and acknowledges late webhooks for
a superseded session instead of returning 500.

The first two migrations have been applied to the BinderFinders Supabase production
project. The second one completed successfully on 25 September 2026.

Do not edit or rerun an already-applied historical migration. The migration is
additive and creates service-only RPCs/tables for payment coordination.

## Production configuration (20 October 2026)

These server-only Vercel Production variables are configured as Secrets. Never
commit their values or place them in a `NEXT_PUBLIC_` variable:

```dotenv
STRIPE_SECRET_KEY=rk_live_... # Restricted live key; Checkout access verified
STRIPE_WEBHOOK_SECRET=whsec_...
```

The hosted Checkout flow does not require a publishable key in this app.
The supplied live publishable key has been added to Vercel Production as
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for future client-side Stripe features;
hosted Checkout still uses only the server-side keys above.
`CRON_SECRET` must also be set: the five-minute cron at
`/api/internal/notifications` reconciles overdue Stripe sessions and expires
unpaid holds, and it rejects every call without that secret.
Keep `CMS_ENABLED=true`, the Supabase server secret, and the public Supabase
URL/key configured as they are for the existing CMS.

The live Stripe webhook endpoint is `we_1USSrvEODLp9W1ZvQb38Hc5T` at:

```text
https://binder-finders.vercel.app/api/webhooks/stripe
```

It subscribes to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

The store currency is **AUD**. `holdsEnabled` remains **false**, so customers
cannot request new holds yet. Production code was deployed as
`dpl_98HxqNkfFbudYuN2kyBhpLRn7bVR`. A live-mode Checkout session was
created and immediately expired without sharing its URL or charging a card;
its expired event has no pending webhook deliveries. The full paid-order flow
has **not** been verified with a real payment.

## Remaining launch checks

1. Rotate the restricted live key that was shared in chat, then replace its
   Vercel Production Secret without putting the replacement in chat.
2. Configure `RESEND_API_KEY` in Vercel Production so hold and payment-related
   customer email delivery can run.
3. Run a controlled end-to-end purchase in Stripe test mode and confirm the
   customer order shows `paid` after webhook delivery.
4. Confirm duplicate webhook delivery does not duplicate or regress the order.
5. Confirm an expired/failed session can be retried.
6. Confirm the CMS can prepare fulfilment and complete the sale only after
   payment and fulfilment requirements are satisfied.
7. Turn on `holdsEnabled` in CMS Settings only after the above checks; this is
   the customer-facing activation switch.

If a payment somehow succeeds after a hold was cancelled or expired (for
example, a pre-existing session created before the safety migration), the
payment is retained as paid for audit safety and requires an operator-managed
refund. No automatic refund policy was assumed.

## Verification completed locally

```sh
npm run test:phase4
npm run test:cms-db
npm run test:phase3
npm test -- --runInBand
npm run build
```

All of these currently pass. The build retains existing `<img>` performance
warnings; they are unrelated to Stripe and do not fail the build.
