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
  "202611020001_hold_payment_integrity.sql",
  "202611020002_hold_workflow_integrity.sql",
  "202611030001_order_alert_email.sql",
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
// Simulate holds reaching their deadline (admins can no longer set one this short).
await as("postgres");
for (const id of [paidAtDeadline, expiredAtDeadline]) {
  await db.query("update public.hold_requests set expires_at=now()+interval '1 second' where id=$1", [id]);
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

// ── Payment integrity guards ─────────────────────────────────────────────
const workflow = (id, status, payment, reference = null) => db.query(
  "select public.cms_set_hold_workflow($1,$2,$3,null,$4,null)", [id, status, payment, reference]);

// A stale admin save cannot undo a Stripe payment or clear its reference.
await as("authenticated", owner);
await assert.rejects(workflow(holdId, null, "unpaid"), /paid through Stripe/);
await db.query("select public.cms_set_hold_workflow($1,null,null,'shipped',null,'Tracking 1')", [holdId]);
await as("postgres");
paid = (await db.query("select payment_status,payment_reference from public.hold_requests where id=$1", [holdId])).rows[0];
assert.equal(paid.payment_status, "paid");
assert.equal(paid.payment_reference, "pi_test_phase4_1");

// A paid hold cannot be cancelled until it is refunded, and then it can.
await as("authenticated", owner);
await assert.rejects(workflow(holdId, "cancelled", null), /Refund the payment/);
await workflow(holdId, "cancelled", "refunded");
await as("postgres");
const refunded = (await db.query("select status,payment_status from public.hold_requests where id=$1", [holdId])).rows[0];
assert.deepEqual(refunded, { status: "cancelled", payment_status: "refunded" });
assert.equal((await db.query("select availability from public.cards where id='phase4-card-1'")).rows[0].availability, "available");

// No manual payment or completion while the customer has Checkout open.
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
await addCard("phase4-card-5");
const openHold = await acceptedHold("phase4-card-5");
await as("service_role");
const openAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [openHold, customer, crypto.randomUUID()])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [openAttempt.attemptId, "cs_test_phase4_open"]);
await as("authenticated", owner);
await assert.rejects(workflow(openHold, null, "paid", "cash"), /Stripe checkout open/);
await db.query("select public.cms_set_hold_workflow($1,null,null,'ready',null,null)", [openHold]);

// The hold always leaves the customer at least 31 minutes to pay.
await addCard("phase4-card-6");
const shortHold = await acceptedHold("phase4-card-6");
await as("authenticated", owner);
await assert.rejects(
  db.query("select public.cms_set_hold_deadline($1,now()+interval '10 minutes')", [shortHold]),
  /at least 31 minutes/,
);
await db.query("select public.cms_set_hold_deadline($1,now()+interval '2 hours')", [shortHold]);

// A late expiry event for an old session leaves the newer Checkout untouched.
await as("service_role");
const oldAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [shortHold, customer, crypto.randomUUID()])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [oldAttempt.attemptId, "cs_test_phase4_old"]);
await db.query("select public.cms_fail_stripe_payment($1,'expired','Checkout session expired')", [oldAttempt.attemptId]);
const newAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [shortHold, customer, crypto.randomUUID()])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [newAttempt.attemptId, "cs_test_phase4_new"]);
await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7)", ["evt_phase4_late_old", "checkout.session.expired", oldAttempt.attemptId, "cs_test_phase4_old", null, "expired", "Stripe checkout session expired"]);
await as("postgres");
assert.equal((await db.query("select payment_status from public.hold_requests where id=$1", [shortHold])).rows[0].payment_status, "pending");

// ── Workflow integrity ───────────────────────────────────────────────────
const holdState = async (id) => {
  await as("postgres");
  return (await db.query("select status,payment_status,fulfillment_status from public.hold_requests where id=$1", [id])).rows[0];
};
const pastDeadline = async (id) => {
  await as("postgres");
  await db.exec("set session_replication_role = replica");
  await db.query("update public.hold_requests set expires_at=now()-interval '1 second' where id=$1", [id]);
  await db.exec("set session_replication_role = origin");
};
await as("postgres");
await db.exec("delete from public.hold_rate_limits");

// A hold that expired while the admin page was open cannot be marked paid or shipped.
await addCard("phase4-card-7");
const staleHold = await acceptedHold("phase4-card-7");
await pastDeadline(staleHold);
await as("service_role");
await db.query("select public.cms_expire_unpaid_holds(50)");
await as("authenticated", owner);
await assert.rejects(workflow(staleHold, null, "paid", "cash"), /expired/);
await assert.rejects(db.query("select public.cms_set_hold_workflow($1,null,null,'shipped',null,null)", [staleHold]), /expired/);
assert.deepEqual(await holdState(staleHold), { status: "expired", payment_status: "unpaid", fulfillment_status: "cancelled" });

// A completed sale keeps its delivery progress and can only become refunded.
await addCard("phase4-card-8");
const soldHold = await acceptedHold("phase4-card-8");
await as("authenticated", owner);
await db.query("select public.cms_set_hold_workflow($1,null,'paid','ready','cash',null)", [soldHold]);
await workflow(soldHold, "completed", null);
await assert.rejects(db.query("select public.cms_set_hold_workflow($1,null,null,'cancelled',null,null)", [soldHold]), /must stay ready/);
await assert.rejects(workflow(soldHold, null, "unpaid"), /only be recorded as refunded/);
await db.query("select public.cms_set_hold_workflow($1,null,null,'delivered',null,null)", [soldHold]);
await workflow(soldHold, null, "refunded");
assert.deepEqual(await holdState(soldHold), { status: "completed", payment_status: "refunded", fulfillment_status: "delivered" });

// A cancelled hold can be recorded as refunded but never as paid.
await addCard("phase4-card-9");
const cancelledHold = await acceptedHold("phase4-card-9");
await as("authenticated", owner);
await workflow(cancelledHold, "cancelled", null);
await assert.rejects(workflow(cancelledHold, null, "paid", "cash"), /cancelled/);
await workflow(cancelledHold, null, "refunded");

// An accepted hold recorded as refunded is released at its deadline.
await addCard("phase4-card-10");
const refundedHold = await acceptedHold("phase4-card-10");
await as("authenticated", owner);
await workflow(refundedHold, null, "refunded");
await pastDeadline(refundedHold);
await as("service_role");
await db.query("select public.cms_expire_unpaid_holds(50)");
assert.equal((await holdState(refundedHold)).status, "expired");
await as("postgres");
assert.equal((await db.query("select availability from public.cards where id='phase4-card-10'")).rows[0].availability, "available");

// Starting Checkout does not email the customer; a payment landing does.
await addCard("phase4-card-11");
const emailHold = await acceptedHold("phase4-card-11");
const statusEmails = async () => {
  await as("postgres");
  return (await db.query("select count(*)::int as count from public.notification_outbox where hold_id=$1 and kind='customer_status_changed'", [emailHold])).rows[0].count;
};
const beforePay = await statusEmails();
await as("service_role");
const emailAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [emailHold, customer, crypto.randomUUID()])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [emailAttempt.attemptId, "cs_test_phase4_email"]);
await db.query("select public.cms_fail_stripe_payment($1,'expired','Checkout expired')", [emailAttempt.attemptId]);
assert.equal(await statusEmails(), beforePay, "Starting or abandoning Checkout sends no email");
await as("service_role");
const paidEmailAttempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [emailHold, customer, crypto.randomUUID()])).rows[0].result;
await db.query("select public.cms_attach_stripe_session($1,$2)", [paidEmailAttempt.attemptId, "cs_test_phase4_email_paid"]);
await db.query("select public.cms_record_stripe_webhook($1,$2,$3,$4,$5,$6,$7)", ["evt_phase4_email_paid", "checkout.session.completed", paidEmailAttempt.attemptId, "cs_test_phase4_email_paid", "pi_email", "success", null]);
assert.equal(await statusEmails(), beforePay + 1, "A landed payment emails the customer");

// Reconciliation rotates through overdue attempts instead of retrying the same ones.
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
const overdue = [];
for (const n of [12, 13]) {
  await addCard(`phase4-card-${n}`);
  const id = await acceptedHold(`phase4-card-${n}`);
  await as("service_role");
  const attempt = (await db.query("select public.cms_begin_stripe_payment($1,$2,$3) as result", [id, customer, crypto.randomUUID()])).rows[0].result;
  await db.query("select public.cms_attach_stripe_session($1,$2)", [attempt.attemptId, `cs_test_phase4_rotate_${n}`]);
  await pastDeadline(id);
  overdue.push(attempt.attemptId);
}
await as("service_role");
const firstBatch = (await db.query("select attempt_id from public.cms_due_stripe_attempts(1)")).rows.map((r) => r.attempt_id);
const secondBatch = (await db.query("select attempt_id from public.cms_due_stripe_attempts(1)")).rows.map((r) => r.attempt_id);
assert.equal(firstBatch.length, 1);
assert.notDeepEqual(firstBatch, secondBatch, "The next run checks a different overdue attempt");

// ── Order alerts go to the store inbox, not every admin login ────────────
const staffAlerts = async (id) => {
  await as("postgres");
  return (await db.query("select to_email from public.notification_outbox where hold_id=$1 and kind='staff_request_received' order by to_email", [id])).rows.map((r) => r.to_email);
};
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
await addCard("phase4-card-14");
assert.deepEqual(await staffAlerts(await submit("phase4-card-14")), ["binderfinders@gmail.com"], "New holds alert the store inbox only");

const editor = "55555555-5555-4555-8555-555555555555";
await as("postgres");
await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'editor@example.test',now())", [editor]);
await db.query("insert into public.admin_users(user_id,email,role) values($1,'editor@example.test','editor')", [editor]);
await as("authenticated", editor);
assert.equal((await db.query("select public.cms_get_order_alert_email() as email")).rows[0].email, "binderfinders@gmail.com");
await assert.rejects(db.query("select public.cms_set_order_alert_email('someone@example.test')"), /Only an owner/);
await as("authenticated", customer);
await assert.rejects(db.query("select public.cms_get_order_alert_email()"), /Administrator access required/);
await as("anon");
await assert.rejects(db.query("select order_alert_email from public.store_private_settings"), /permission denied/);

await as("authenticated", owner);
await assert.rejects(db.query("select public.cms_set_order_alert_email('not-an-email')"), /valid email/);
await db.query("select public.cms_set_order_alert_email('  Orders@Example.TEST ')");
assert.equal((await db.query("select public.cms_get_order_alert_email() as email")).rows[0].email, "orders@example.test");
await db.query("select public.cms_set_order_alert_email('')");
await addCard("phase4-card-15");
assert.deepEqual(await staffAlerts(await submit("phase4-card-15")), ["editor@example.test", "owner@example.test"], "With no store inbox, every active admin is alerted");

await db.close();
console.log("Phase 4 payment checks passed: payment flow, webhook safety, deadline reconciliation, and inventory protection during active Checkout, payment integrity guards, workflow integrity, and order alert routing.");
