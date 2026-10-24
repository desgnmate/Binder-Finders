# BinderFinders store manager

## Current setup

The CMS lives at `/admin` and uses Supabase project `zovjsqrcfcnptcihzmlw`.
The initial migration is installed. The original 16 listings and three binder
collections were imported without changing listing IDs or prices. The requested
owner invitation has been sent and its active owner membership verified. The
recipient must still accept the invitation and set their own password.
Currency is intentionally unset and customer hold
submissions are disabled until the store owner confirms its currency.

The integration is enabled locally and deployed to production at
`https://binder-finders.vercel.app/admin`. Release `dpl_CzkmeKHPNV5Se56NNgLFSXRtSfQH`
passed public-page and protected-admin checks. The existing custom-domain path
`https://www.binderfinders.com/admin/login` redirects to
`https://binderfinders.com/admin/login`, which returned 404 during release checks.
Use the Vercel URL until domain routing is resolved; DNS was not changed.
Future publication remains a separate release step: changing local files alone
does not deploy the site.

## What the client can manage

- Cards: create, edit, duplicate as a draft, publish, archive, change prices,
  description, set, National Pokédex number, condition, rarity and availability.
- Scans: upload front/back images and up to ten additional photos. Accepted
  formats: JPEG, PNG and WebP, up to 8 MB each. Removing an image from a listing
  does not permanently delete the underlying asset.
- Homepage carousel: set a featured order on a card, or leave it blank to omit it.
- Binder collections: create, rename, reorder and choose/reorder their cards.
  Published cards outside a collection remain accessible under More cards.
- Website content: edit the two hero lines, subtitle, button label, About copy,
  footer copy, email and location. These are bounded text fields, not arbitrary
  HTML or layout editing. Existing responsive layouts are retained.
- Requests: review buyer details, accept/reject/cancel a hold, and mark a sale
  complete. Pending requests do not reserve stock. Acceptance reserves stock;
  cancellation releases it; completion marks it sold. Two requests cannot both
  reserve the same listing.
- Owner settings: currency, enable/disable new requests, invite editors, and
  manage administrator access. Editors cannot change these settings or roles.
- Activity: inspect recent change history with before/after records.

This remains a manual hold-and-contact shop, not a payment processor. There is
no payment capture, shipping integration, automatic hold expiration, or automatic
customer confirmation email. Staff follow up manually. Invitations and password
recovery use Supabase Auth email delivery, which still needs a real-recipient
delivery check and may require custom SMTP for non-project recipients.

## Safety and permissions

Every admin action verifies a Supabase user and an active admin membership.
Database row-level policies hide drafts, customer details, membership and audit
data from public visitors. Stock and prices are validated transactionally by
database functions; stale edits are rejected rather than overwriting newer work.
Public hold requests pass a same-origin check, input validation, an empty
honeypot, idempotency key and database rate limits (five requests per 15 minutes
per email/IP key). This is basic abuse control, not full bot protection.

The scans bucket is private. `/api/scans/...` only serves an image to public
visitors if a published card references it; active admins can view draft scans.
This endpoint is deliberately uncached to avoid leaking archived/draft images.

`SUPABASE_SECRET_KEY` is server-only and must never get a `NEXT_PUBLIC_` prefix.
The anon key is intentionally public: access depends on RLS, not hiding that key.
Rotate any server secret previously pasted into chat before production release,
and replace it in both the ignored local environment and Vercel.

## Local environment

Keep these values in ignored `.env.local` (never in source or documentation):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=https://binder-finders.vercel.app
CMS_ENABLED=true
```

`CMS_ENABLED` is an explicit migration switch. Before activation, the site uses
its original bundled catalog. After activation, a database failure shows an
unavailable state instead of restoring stale sample stock. Do not use the old
sample catalog as a rollback after taking real orders.

Useful verification commands:

```sh
npm test -- --runInBand --silent
npm run test:cms-db
BINDERFINDERS_DIST_DIR=.next-cms npm run build
npm audit --omit=dev
```

The database test uses an isolated in-memory Postgres engine and no live
credentials. `scripts/test-cms-live.mjs` is restricted to an isolated Supabase
test project, an explicitly configured test account, and
`CMS_TEST_ALLOW_MUTATIONS=true`. Its localhost server must use that same test
project. It refuses the production project because it temporarily changes store
settings. Do not run this workflow on a live store.

## Initial owner handoff

1. Obtain the exact owner email and store currency from the client.
2. Configure Supabase email delivery and verify invitations can reach that email.
3. Invite that specific recipient through Supabase Auth. Do not choose a shared
   or guessed email and do not distribute a temporary password.
4. Grant that verified user's UUID an active `owner` membership in `admin_users`
   using a trusted server-side administrative connection. Confirm its email
   matches the Auth record. There is no public signup-to-admin path.
5. The recipient follows the invitation to `/admin/reset-password`, sets their
   own password, then signs in at `/admin`.
6. Choose the agreed currency, review prices (currency selection does not convert
   amounts), and only then enable requests when staff are ready to handle them.

Supabase Site URL is set to `https://binder-finders.vercel.app`; the exact
`https://binder-finders.vercel.app/admin/reset-password` redirect is allowlisted.
If the production domain changes, update both Supabase and `NEXT_PUBLIC_SITE_URL`.
Avoid wildcard recovery redirects.

## Deployment and rollback

The existing Vercel project is `desgnmates-projects/binder-finders`.
Publish only with the user's release authorization after checks pass.
Set the five environment variables above for production only. Treat the secret
as sensitive/server-only; classify the explicitly public anon key as public
configuration when Vercel asks. Never log values or send credentials in URLs.
Preview environments should use a separate Supabase test project.

Deploy, then verify the public catalog, unauthenticated admin redirect, owner
login, draft privacy, uploaded scan access, and that no private tables are
publicly readable. A preview built without production variables cannot safely
be promoted as though it used them. Verify the actual production build.

If a release fails, roll back the application deployment without dropping the
database or re-seeding. Disable incoming requests first if stock handling is
affected. Preserve accepted holds, real listings and audit history. Do not
re-run the initial schema on an initialized project.

`npm run cms:seed` intentionally refuses a nonempty catalog. The original import
has already been completed; do not use it to reset client-managed data.

## Capacity and maintenance

The initial admin console displays the latest 1,000 cards, 200 requests and 100
activity entries. It labels these limits; older records remain in the database.
Add server-side pagination before operating beyond these limits. Public catalog
reads currently use Supabase's default result cap (1,000 rows); the initial
16-card store is below it. Plan pagination before a large catalog import.

Review Supabase backup/restore coverage and storage backups before live sales.
Audit records are useful history, not a substitute for tested backups. Orphaned
uploaded images are retained for safety; any cleanup should first prove that no
published/draft card references them. Decide customer-data retention with the
owner before adding automated deletion.

Pokédex reference data (`lib/cms/pokemon.json`) is a bundled snapshot of species,
English names, generation and default-form types through National ID 1025 from
the [PokeAPI data repository](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).
Existing local sprites are preserved. New species use the public
[PokeAPI sprite repository](https://github.com/PokeAPI/sprites). Refresh the
snapshot deliberately when supporting future species; it is not a live API
dependency for catalog loading.
