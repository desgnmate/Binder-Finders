# Customer accounts — Phase 1

## Repair status — 2026-09-22

The earlier phase-complete claims were too broad. The code repairs below are
implemented and locally tested; this does **not** mean production is activated.

- Shared canonical same-origin redirect validation now protects the auth action,
  callback and auth-page return destinations, including backslash/control inputs.
- `202609250001_workflow_delivery_safety.sql` is a new forward-only repair, not
  an edit to an already applied migration. It enforces payment/fulfilment checks
  on the hold table, including calls through the legacy transition RPC. Failed
  transitions roll back inventory changes. Completed sales can record delivery
  and external refunds without automatically relisting sold cards.
- Payment, fulfilment, reference and customer-visible fulfilment-note changes
  enqueue one final-state customer update per transaction. No-op saves do not.
- Completed/cancelled orders retain workflow controls. Recording “refunded” is
  bookkeeping only; it does not issue a monetary refund.
- Email claims now have five-minute leases and unique ownership tokens. Old
  workers cannot acknowledge a replacement worker's claim. Timed-out sends use
  a stable provider idempotency key and a database-frozen request body.
- Retries are bounded to five attempts and stop before Resend's 24-hour
  deduplication window expires (23-hour safety cutoff). Exhausted/ambiguous jobs
  remain `failed` for operator review, not automatic replay. Legacy attempted
  jobs without idempotency protection are also retained for review.
- Worker HTTP responses distinguish provider failures from database acknowledgement
  failures. `sent` means provider accepted plus database acknowledged, **not** proof
  of inbox delivery. The worker uses a five-message batch and eight-second fetch
  timeout under a 60-second function limit.

### Checks completed for the repair

- Full Jest suite, including redirect/callback and notification-worker regressions.
- Admin UI tests: completed-order shipping changes, cancelled-request refund
  records, and rejected-save feedback.
- `node scripts/test-cms-db.mjs`: legacy completion bypass rejected; inventory
  rollback; metadata-only notifications; final-state deduplication; no-op saves;
  post-completion delivery/refunds; lease recovery; stale acknowledgement denial;
  frozen provider body; retry backoff/limits; service-only worker access.
- `node scripts/test-customer-db.mjs`: profile ownership and isolation.
- Production build/type check; browser signup/sign-in navigation and console check.
- No real orders or customer emails were used for these regression tests.

### Production blockers confirmed during repair

- Supabase repair migration is awaiting approval/application via the authenticated
  SQL editor. Run the new migration once, after the existing four migrations.
  Do not rerun historical migrations or use the live fixture script against an
  active notification worker.
- Supabase currently allows only the production **admin** reset URL and two
  localhost customer callbacks. Add the exact production customer callback
  `https://binder-finders.vercel.app/account/callback`, plus a query-capable
  callback entry for `next` and `flow=recovery`. Keep the existing admin URL.
  Scope any wildcard to this callback path, never all domains or all site paths.
- Supabase still shows its built-in test email service. Configure a verified
  production SMTP sender and preserve `{{ .ConfirmationURL }}` in shared auth
  templates. Do not disable email confirmation to bypass this requirement.
- Vercel production currently lacks `CRON_SECRET`, `RESEND_API_KEY`, and
  `RESEND_FROM_EMAIL`. Add server-only values through secure settings, not source
  code or chat. Use a domain verified by the chosen provider.
- The five-minute cron requires a compatible Vercel plan. Confirm this before
  deployment; do not silently switch order email delivery to a daily schedule.
- Production has not been redeployed with this repair. Deploy after applying the
  migration and callback configuration, then verify account routes, authenticated
  order history, worker authorization, and actual signup/recovery/hold emails.
- Keep holds disabled until the store owner confirms currency and the complete
  email/hold journey succeeds. No paid service, payment capture, or store-currency
  choice was made as part of these repairs.

### Failed-email review

Inspect `notification_outbox` failed jobs using privileged database access.
Compare the stable key `binderfinders-notification-<id>` with provider logs before
replaying an ambiguous job. Never reset every failed job automatically: a provider
may already have accepted it. Preserve the outbox row/body as the audit record.

The original implementation notes below are retained as historical context.

## Implemented locally
- /account: verified-session guard, editable name and logout.
- /account/login, /account/signup, /account/verify (resend).
- /account/forgot-password and /account/reset-password.
- /account/callback: customer-only PKCE code exchange, fixed destination allowlist.
- /account/link-error: expired/used/cross-browser link recovery.
- Separate customer profile table and ownership policies; no admin privileges assigned by signup.
- Middleware refreshes account sessions and marks responses private/no-store.
- No checkout, inventory, hold or order workflow changes in this phase.

## Activation status
1. Applied `supabase/migrations/202609220001_customer_accounts.sql` to the configured Supabase project. It only adds `customer_profiles` and its policies; existing tables remain intact.
2. Added the localhost callback URLs for normal verification and password recovery. The existing admin reset URL remains unchanged. Production callback URLs still need to be added before a production release.
3. Enabled Supabase email signup and email confirmation. The 12-character minimum is enforced in both the browser form and the server action. Existing admin passwords are not changed by the application.
4. Production SMTP is still pending. The Supabase project is using the built-in test email service, so a real signup test hit the provider's email rate limit rather than delivering a confirmation message. Configure a verified sender before launch.
5. Verification and recovery email templates must continue using Supabase's `{{ .ConfirmationURL }}` so the customer callback and PKCE exchange remain intact. Do not replace shared admin templates with a customer-only URL.
6. The remaining real-inbox test is: sign up, verify in the requesting browser, save/reload profile, logout/login, request recovery, change password, login using the new password, and confirm the customer cannot access `/admin`.

## Design decisions
- Reuse Supabase Auth. Customers and admins share the auth provider, while admin_users remains the exclusive admin authorization list. One browser session uses one identity.
- Profiles are created on first profile save; identity and verified email remain in Supabase Auth.
- Customer callback does not modify the admin callback.
- PKCE email links need the browser that initiated signup/reset. Error page explains how to request another link.
- No production deployment in Phase 1; storefront entry links can be enabled with release.

## Verification
- Completed: production build, TypeScript check, 5 focused customer/admin authentication tests, customer database isolation tests, and existing CMS database checks.
- Browser reviewed signup layout and confirmed anonymous /account redirects to /account/login on localhost:3102.
- The production database migration and signup settings are complete. Production callback configuration, SMTP delivery, and deployment remain pending.
- node scripts/test-customer-db.mjs checks self-read/update, cross-account read/write denial, ID modification denial and anonymous denial.
- CustomerAuthForm tests cover customer callback URLs, safe reset messaging, password mismatch and expired session.
- Run existing AuthForm and CMS database tests to check admin isolation.

## Phase 2 — customer-linked holds
- Checkout now checks for a verified customer session before submitting a hold.
- Signed-out customers are returned to `/account/login?next=/checkout`; the existing local bag survives the redirect.
- Authenticated checkout pre-fills the account email/name and submits through a new service-only RPC that records `customer_user_id`.
- Added `/account/orders` for a customer's own hold history. RLS permits customers to read only their own requests and items; admin access remains unchanged.
- Added safe `next` handling to login, signup, verification, recovery, and the customer callback so customers return to checkout after authentication.
- Applied `supabase/migrations/202609230001_customer_holds.sql` to the configured Supabase project. The older two-argument service RPC remains during rollout for backward compatibility.
- Verified the new live RPC exists, rejects unverified identities, and is denied to anonymous callers.

## Phase 3 — notifications and fulfilment workflow
- Added payment and fulfilment fields to each hold request without changing the existing card-reservation state machine.
- Staff can record payment and fulfilment progress from the Hold requests screen. A sale can be completed only after payment is marked paid and fulfilment is prepared, shipped, delivered, or picked up.
- Customers see payment and fulfilment progress in `/account/orders`.
- Added a transactional notification outbox. New requests queue a customer receipt and one message for each active administrator; accepted, rejected, cancelled, and completed status changes queue a customer update.
- The queue is claimed with row locking and retries failed deliveries up to five attempts. `/api/internal/notifications` sends the claimed batch through Resend and is scheduled every five minutes in `vercel.json`.
- The email worker is deliberately fail-closed: configure `CRON_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` before enabling production notifications. A missing mail configuration leaves queued notifications untouched rather than losing them.
- Payment capture is not included yet. The workflow records manual or external payment confirmation and reference data; a processor such as Stripe must be selected and explicitly integrated before charging customers.

### Phase 3 release checklist
1. Apply `supabase/migrations/202609240001_phase3_workflow_notifications.sql` to the production Supabase project.
2. Add `CRON_SECRET`, `RESEND_API_KEY`, and a verified `RESEND_FROM_EMAIL` to the Vercel project.
3. Send a real test request and confirm the customer receipt, administrator notification, and each customer status email.
4. Confirm the cron endpoint returns `401` without the secret and processes only queued notifications with it.
5. Keep payment capture disabled until the business chooses a provider, refund policy, and fulfilment/shipping policy.
