import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
const migrations = [
  "202609160001_cms.sql",
  "202609230001_customer_holds.sql",
  "202609240001_phase3_workflow_notifications.sql",
  "202609250001_workflow_delivery_safety.sql",
  "202609260001_phase3_hold_management.sql",
  "202609270001_phase4_stripe_payments.sql",
  "202609280001_phase4_checkout_safety.sql",
  "202610240001_phase4_payment_retry_fix.sql",
];
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
`);
for (const file of migrations) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));

const owner = "11111111-1111-4111-8111-111111111111";
const customer = "33333333-3333-4333-8333-333333333333";
const otherCustomer = "44444444-4444-4444-8444-444444444444";
await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now()),($2,'customer@example.test',now()),($3,'other@example.test',now())`, [owner, customer, otherCustomer]);
await db.query(`insert into public.admin_users(user_id,email,role) values($1,'owner@example.test','owner')`, [owner]);
await db.query(`insert into public.store_settings(data) values($1)`, [{ currency: "AUD", holdsEnabled: true, holdDurationHours: 48, content: {} }]);

async function as(role, id = "") {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec(`set role ${role}`);
}

async function addCard(id) {
  await as("authenticated", owner);
  await db.query("select public.cms_save_card($1,null)", [{
    id, name: id, pokemonId: 6, set: "Base Set", year: 1999, number: "4/102",
    imageUrl: "/test.jpg", price: 12.5, publication: "published", availability: "available", featuredOrder: null,
  }]);
}

async function submit(cardId) {
  await as("service_role");
  return (await db.query("select public.cms_submit_hold($1,$2,$3) as id", [{
    name: "Test customer", email: "customer@example.test", note: "", cardIds: [cardId], prices: { [cardId]: 1250 }, requestKey: crypto.randomUUID(),
  }, "phase4-test-ip", customer])).rows[0].id;
}

async function acceptedHold(cardId) {
  const id = await submit(cardId);
  await as("authenticated", owner);
  await db.query("select public.cms_transition_hold($1,'accepted')", [id]);
  return id;
}

const holdId = await (async () => { await addCard("phase4-card-1"); return acceptedHold("phase4-card-1"); })();
const key = crypto.randomUUID();
await as("service_role");
const started = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [holdId, customer, key])).rows[0].result;
assert.equal(started.state, "create");
assert.equal(started.amountCents, 1250);
assert.equal(started.currency, "aud");
await as("postgres");
assert.equal((await db.query("select payment_status from public.hold_requests where id=$1", [holdId])).rows[0].payment_status, "pending");
assert.ok((await db.query("select count(*)::int as count from public.payment_attempts where hold_id=$1", [holdId])).rows[0].count === 1);

await as("service_role");
assert.equal((await db.query("select public.cms_attach_stripe_session($1,$2) as ok", [started.attemptId, "cs_test_phase4_1"])).rows[0].ok, true);
const retry = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [holdId, customer, crypto.randomUUID()])).rows[0].result;
assert.equal(retry.state, "existing");
assert.equal(retry.sessionId, "cs_test_phase4_1");
const sameKey = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [holdId, customer, key])).rows[0].result;
assert.equal(sameKey.state, "existing", "A reused key returns its open session instead of creating another");
assert.equal(sameKey.sessionId, "cs_test_phase4_1");
await assert.rejects(
  db.query("select public.cms_begin_stripe_payment($1,$2,$3)", [holdId, otherCustomer, crypto.randomUUID()]),
  /Request not found/,
);

assert.equal((await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7) as ok", ["evt_phase4_success", "checkout.session.completed", started.attemptId, "cs_test_phase4_1", "pi_test_phase4_1", "success", null])).rows[0].ok, true);
await as("postgres");
let paid = (await db.query("select payment_status,payment_reference,stripe_payment_intent_id,paid_at from public.hold_requests where id=$1", [holdId])).rows[0];
assert.equal(paid.payment_status, "paid");
assert.equal(paid.payment_reference, "pi_test_phase4_1");
assert.ok(paid.paid_at);
assert.equal((await db.query("select status from public.payment_attempts where id=$1", [started.attemptId])).rows[0].status, "paid");
await as("service_role");
assert.equal((await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7) as ok", ["evt_phase4_success", "checkout.session.completed", started.attemptId, "cs_test_phase4_1", "pi_test_phase4_1", "success", null])).rows[0].ok, true);
await as("postgres");
assert.equal((await db.query("select count(*)::int as count from public.stripe_webhook_events where event_id='evt_phase4_success'")).rows[0].count, 1);

await addCard("phase4-card-2");
const failedHold = await acceptedHold("phase4-card-2");
const failedKey = crypto.randomUUID();
await as("service_role");
const failedStart = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [failedHold, customer, failedKey])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [failedStart.attemptId, "cs_test_phase4_2"]);
await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7)", ["evt_phase4_expired", "checkout.session.expired", failedStart.attemptId, "cs_test_phase4_2", null, "expired", "Checkout session expired"]);
await as("postgres");
assert.equal((await db.query("select payment_status,payment_failure_reason from public.hold_requests where id=$1", [failedHold])).rows[0].payment_status, "failed");
await as("service_role");
const restarted = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [failedHold, customer, crypto.randomUUID()])).rows[0].result;
assert.equal(restarted.state, "create", "A failed/expired attempt can be retried");
await assert.rejects(
  db.query("select public.cms_begin_stripe_payment($1,$2,$3)", [failedHold, customer, failedKey]),
  /expired/,
  "A finished attempt's key is never reused for a new Stripe session",
);
await db.query("select public.cms_attach_stripe_session($1,$2)", [restarted.attemptId, "cs_test_phase4_2b"]);
assert.equal((await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7) as ok", ["evt_phase4_stale", "checkout.session.expired", restarted.attemptId, "cs_test_phase4_2", null, "expired", "Checkout session expired"])).rows[0].ok, true, "Stale session events are acknowledged");
await as("postgres");
assert.equal((await db.query("select status from public.payment_attempts where id=$1", [restarted.attemptId])).rows[0].status, "open");
await as("service_role");

await addCard("phase4-card-3");
await addCard("phase4-card-4");
const paidAtDeadline = await acceptedHold("phase4-card-3");
const expiredAtDeadline = await acceptedHold("phase4-card-4");
await as("authenticated", owner);
for (const id of [paidAtDeadline, expiredAtDeadline]) {
  await db.query("select public.cms_set_hold_deadline($1,now()+interval '1 second')", [id]);
}
await as("service_role");
const paidAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [paidAtDeadline, customer, crypto.randomUUID()])).rows[0].result;
const expiringAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [expiredAtDeadline, customer, crypto.randomUUID()])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [paidAttempt.attemptId, "cs_test_phase4_deadline_paid"]);
await db.query("select public.cms_attach_stripe_session($1,$2)", [expiringAttempt.attemptId, "cs_test_phase4_deadline_expired"]);
await as("authenticated", customer);
await assert.rejects(db.query("select public.cms_cancel_customer_hold($1)", [paidAtDeadline]), /Payment is in progress/);
await as("authenticated", owner);
await assert.rejects(db.query("select public.cms_transition_hold($1,'cancelled')", [paidAtDeadline]), /Payment is in progress/);
await new Promise((resolve) => setTimeout(resolve, 1100));
await as("service_role");
const due = (await db.query("select attempt_id from public.cms_due_stripe_attempts(20)")).rows;
assert.ok(due.some((row) => row.attempt_id === paidAttempt.attemptId));
assert.ok(due.some((row) => row.attempt_id === expiringAttempt.attemptId));
assert.equal((await db.query("select public.cms_expire_unpaid_holds(20) as count")).rows[0].count, 0, "Active checkouts keep inventory reserved");
await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7)", ["evt_deadline_paid", "checkout.session.completed", paidAttempt.attemptId, "cs_test_phase4_deadline_paid", "pi_deadline_paid", "success", null]);
await db.query("select public.cms_fail_stripe_payment($1,'expired','Checkout expired')", [expiringAttempt.attemptId]);
assert.equal((await db.query("select public.cms_expire_unpaid_holds(20) as count")).rows[0].count, 1);
await as("postgres");
assert.equal((await db.query("select status,payment_status from public.hold_requests where id=$1", [paidAtDeadline])).rows[0].payment_status, "paid");
assert.equal((await db.query("select status from public.hold_requests where id=$1", [expiredAtDeadline])).rows[0].status, "expired");

await db.close();
console.log("Phase 4 payment checks passed: payment flow, webhook safety, deadline reconciliation, and inventory protection during active Checkout.");
