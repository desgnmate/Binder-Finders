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
  "202611070001_notification_payload_details.sql",
  "202611130001_guest_checkout_settings.sql",
  "202611130002_guest_checkout_orders.sql",
  "202611130003_guest_checkout_reservation.sql",
  "202611130004_guest_card_protection.sql",
  "202611130005_guest_admin_card_safety.sql",
  "202611130006_guest_stripe_payment_attempts.sql",
  "202611130007_guest_stripe_payment_workflow.sql",
  "202611130008_guest_terminal_card_transitions.sql",
  "202611130009_guest_stripe_webhook.sql",
  "202611130010_guest_checkout_duration_setting.sql",
  "202611130011_guest_checkout_reservation_expiry.sql",
  "202611130012_guest_reconciliation_expiry.sql",
  "202611130013_guest_payment_deadline.sql",
  "202611130014_guest_unattached_payment_cleanup.sql",
  "202611130015_guest_reconciliation_payload.sql",
  "202611130016_guest_checkout_rate_limit.sql",
  "202611140001_hold_delete_and_delivery.sql",
  "202611140002_order_qa_fixes.sql",
  "202611140017_guest_late_payment_review.sql",
  "20261116041608_guest_shipping_options.sql",

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

const shippingCases = [
  [10000, "shipping", "tracked", true, 1000, 250],
  [10001, "shipping", "tracked", true, 1000, 500],
  [20000, "shipping", "express", true, 1500, 500],
  [20001, "shipping", "express", true, 1500, 750],
  [1250, "shipping", "tracked", false, 1000, 0],
  [1250, "shipping", "express", false, 1500, 0],
  [1250, "pickup", null, false, 0, 0],
];

for (const [subtotal, method, service, insured, shipping, insurance] of shippingCases) {
  const result = (await db.query(
    "select public.cms_guest_shipping_quote($1,$2,$3,$4) as quote",
    [subtotal, method, service, insured],
  )).rows[0].quote;

  assert.equal(result.shippingFeeCents, shipping);
  assert.equal(result.insuranceFeeCents, insurance);
  assert.equal(result.totalCents, subtotal + shipping + insurance);
}

await assert.rejects(
  db.query(
    "select public.cms_guest_shipping_quote($1,$2,$3,$4)",
    [1250, "pickup", null, true],
  ),
  /Pickup cannot include shipping or insurance/,
);

console.log("Guest shipping and insurance boundary checks passed.");
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

// -- Payment integrity guards --
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

// -- Workflow integrity --
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

// -- Order alerts go to the store inbox, not every admin login --
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
await as("authenticated", owner);
const ownerSettingsBefore = (await db.query("select data,updated_at from public.store_settings where id=true")).rows[0];
await db.query("select public.cms_save_settings($1,$2)", [
  { ...ownerSettingsBefore.data, guestCheckoutEnabled: true, shippingFeeCents: 1250 },
  ownerSettingsBefore.updated_at,
]);
const ownerSettingsAfter = (await db.query("select data,updated_at from public.store_settings where id=true")).rows[0];
assert.equal(ownerSettingsAfter.data.guestCheckoutEnabled, true, "Owner can enable Guest Checkout");
assert.equal(ownerSettingsAfter.data.shippingFeeCents, 1250, "Owner can configure shipping");
await assert.rejects(
  db.query("select public.cms_save_settings($1,$2)", [
    { ...ownerSettingsAfter.data, currency: "" },
    ownerSettingsAfter.updated_at,
  ]),
  /Choose a currency/,
  "Guest Checkout requires a configured currency",
);
await db.query("select public.cms_save_settings($1,$2)", [
  { ...ownerSettingsAfter.data, guestCheckoutEnabled: false, shippingFeeCents: null },
  ownerSettingsAfter.updated_at,
]);
const guestSettingsReset = (await db.query("select data from public.store_settings where id=true")).rows[0];
assert.equal(guestSettingsReset.data.guestCheckoutEnabled, false);
assert.equal(guestSettingsReset.data.shippingFeeCents, null);
await as("authenticated", editor);
const guestSettingsRow = (await db.query("select data,updated_at from public.store_settings where id=true")).rows[0];
await assert.rejects(
  db.query("select public.cms_save_settings($1,$2)", [
    { ...guestSettingsRow.data, guestCheckoutEnabled: true },
    guestSettingsRow.updated_at,
  ]),
  /Only an owner/,
  "Editors cannot enable Guest Checkout",
);
await assert.rejects(
  db.query("select public.cms_save_settings($1,$2)", [
    { ...guestSettingsRow.data, shippingFeeCents: 1250 },
    guestSettingsRow.updated_at,
  ]),
  /Only an owner/,
  "Editors cannot change shipping fees",
);
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

// -- Email payload carries the order link, deadline and card details --
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
await addCard("phase4-card-16");
const emailHoldId = await acceptedHold("phase4-card-16");
await as("postgres");
const reservedEmail = (await db.query("select payload from public.notification_outbox where hold_id=$1 and kind='customer_status_changed' order by id desc limit 1", [emailHoldId])).rows[0].payload;
assert.equal(reservedEmail.holdId, emailHoldId);
assert.ok(reservedEmail.expiresAt, "The reserved email knows the payment deadline");
assert.equal(reservedEmail.items[0].set, "Base Set");
assert.equal(reservedEmail.items[0].number, "4/102");


// Guest Orders foundation security checks
await as("postgres");
await addCard("guest-test-card-1");
await addCard("guest-test-card-2");

const guestOrderKey = crypto.randomUUID();

await as("anon");
await assert.rejects(
  db.query("select * from public.guest_orders"),
  /permission denied/,
  "Anonymous users cannot read guest orders",
);
await assert.rejects(
  db.query("select * from public.guest_order_items"),
  /permission denied/,
  "Anonymous users cannot read guest order items",
);

await as("authenticated", customer);
await assert.rejects(
  db.query("select * from public.guest_orders"),
  /permission denied/,
  "Customers cannot read guest orders directly",
);
await assert.rejects(
  db.query("select * from public.guest_order_items"),
  /permission denied/,
  "Customers cannot read guest order items directly",
);

await as("service_role");
const guestOrder = (await db.query(`
  insert into public.guest_orders
    (request_key,name,email,fulfillment_method,currency,
     subtotal_cents,shipping_fee_cents,total_cents)
  values ($1,'Guest Test','guest@example.test','pickup','AUD',1250,0,1250)
  returning id
`, [guestOrderKey])).rows[0].id;

await assert.rejects(
  db.query(`
    insert into public.guest_orders
      (request_key,name,email,fulfillment_method,currency,
       subtotal_cents,shipping_fee_cents,total_cents)
    values ($1,'Duplicate','duplicate@example.test','pickup','AUD',1250,0,1250)
  `, [guestOrderKey]),
  /duplicate key/,
  "Duplicate request keys are rejected",
);

await assert.rejects(
  db.query(`
    insert into public.guest_orders
      (request_key,name,email,fulfillment_method,currency,
       subtotal_cents,shipping_fee_cents,total_cents)
    values ($1,'Invalid','invalid@example.test','pickup','AUD',1250,100,1250)
  `, [crypto.randomUUID()]),
  /check constraint/,
  "Incorrect order totals are rejected",
);

await db.query(`
  insert into public.guest_order_items(order_id,card_id,name,price_cents)
  values ($1,'guest-test-card-1','Test card',1250)
`, [guestOrder]);

await assert.rejects(
  db.query(`
    insert into public.guest_order_items(order_id,card_id,name,price_cents)
    values ($1,'missing-guest-card','Missing card',1250)
  `, [guestOrder]),
  /foreign key/,
  "Order items must reference existing cards",
);

await as("postgres");
await assert.rejects(
  db.query(`
    update public.cards
    set guest_reserved_by=$1
    where id='guest-test-card-1'
  `, [guestOrder]),
  /check constraint/,
  "Guest reservations require reserved availability",
);

await db.query(`
  update public.cards
  set availability='reserved',guest_reserved_by=$1
  where id='guest-test-card-1'
`, [guestOrder]);

await as("postgres");
const existingHold = await acceptedHold("guest-test-card-2");

await as("postgres");
await assert.rejects(
  db.query(`
    update public.cards
    set guest_reserved_by=$1
    where id='guest-test-card-2'
  `, [guestOrder]),
  /check constraint/,
  "A card cannot be reserved by Hold and Guest simultaneously",
);

await as("postgres");
const guestReserved = (await db.query(`
  select availability,guest_reserved_by
  from public.cards
  where id='guest-test-card-1'
`)).rows[0];

assert.equal(guestReserved.availability, "reserved");
assert.equal(guestReserved.guest_reserved_by, guestOrder);

console.log("Guest Orders foundation checks passed.");

// Guest Checkout reservation RPC tests
await addCard("guest-rpc-card-1");
await addCard("guest-rpc-card-2");

const guestRpcRequest = {
  requestKey: crypto.randomUUID(),
  name: "Guest Customer",
  email: "guest-rpc@example.test",
  fulfillmentMethod: "pickup",
  shippingService: null,
  insuranceSelected: false,
  cardIds: ["guest-rpc-card-1"],
};

await as("anon");
await assert.rejects(
  db.query("select public.cms_begin_guest_checkout($1)", [guestRpcRequest]),
  /permission denied/,
  "Anonymous users cannot execute the reservation RPC",
);

await as("authenticated", customer);
await assert.rejects(
  db.query("select public.cms_begin_guest_checkout($1)", [guestRpcRequest]),
  /permission denied/,
  "Authenticated customers cannot execute the reservation RPC directly",
);

await as("service_role");
await assert.rejects(
  db.query("select public.cms_begin_guest_checkout($1)", [guestRpcRequest]),
  /Guest Checkout is currently unavailable/,
  "Disabled Guest Checkout rejects reservations",
);

await as("authenticated", owner);
const rpcSettingsBefore = (await db.query(
  "select data,updated_at from public.store_settings where id=true"
)).rows[0];

await db.query(
  "select public.cms_save_settings($1,$2)",
  [
    {
      ...rpcSettingsBefore.data,
      guestCheckoutEnabled: true,
      shippingFeeCents: 250,
    },
    rpcSettingsBefore.updated_at,
  ],
);

await as("service_role");
const rpcFirst = (await db.query(
  "select public.cms_begin_guest_checkout($1) as result",
  [guestRpcRequest],
)).rows[0].result;

assert.equal(rpcFirst.existing, false);
assert.equal(rpcFirst.status, "reserved");
assert.equal(rpcFirst.currency, "AUD");
assert.equal(rpcFirst.subtotalCents, 1250);
assert.equal(rpcFirst.shippingFeeCents, 0);
assert.equal(rpcFirst.totalCents, 1250);

const rpcRetry = (await db.query(
  "select public.cms_begin_guest_checkout($1) as result",
  [guestRpcRequest],
)).rows[0].result;

assert.equal(rpcRetry.existing, true);
assert.equal(rpcRetry.orderId, rpcFirst.orderId);
assert.equal(rpcRetry.totalCents, 1250);

await assert.rejects(
  db.query(
    "select public.cms_begin_guest_checkout($1)",
    [{ ...guestRpcRequest, email: "different@example.test" }],
  ),
  /already used/,
  "A request key cannot be reused with different customer details",
);

await assert.rejects(
  db.query(
    "select public.cms_begin_guest_checkout($1)",
    [{
      ...guestRpcRequest,
      requestKey: crypto.randomUUID(),
    }],
  ),
  /no longer available/,
  "Another checkout cannot reserve an already reserved card",
);

await assert.rejects(
  db.query(
    "select public.cms_begin_guest_checkout($1)",
    [{
      ...guestRpcRequest,
      requestKey: crypto.randomUUID(),
      cardIds: ["guest-rpc-card-2", "guest-rpc-card-2"],
    }],
  ),
  /unique cards/,
  "Duplicate card IDs are rejected",
);

const rpcShipping = (await db.query(
  "select public.cms_begin_guest_checkout($1) as result",
  [{
    requestKey: crypto.randomUUID(),
    name: "Shipping Customer",
    email: "shipping@example.test",
    fulfillmentMethod: "shipping",
    shippingService: "tracked",
    insuranceSelected: true,
    shippingAddress: {
      line1: "123 Test Street",
      city: "Sydney",
      postalCode: "2000",
      country: "Australia",
    },
    cardIds: ["guest-rpc-card-2"],
  }],
)).rows[0].result;

assert.equal(rpcShipping.subtotalCents, 1250);
assert.equal(rpcShipping.shippingFeeCents, 1000);
assert.equal(rpcShipping.insuranceSelected, true);
assert.equal(rpcShipping.insuranceFeeCents, 250);
assert.equal(rpcShipping.totalCents, 2500);

const storedShippingOrder = (await db.query(
  "select total_cents,insurance_fee_cents from public.guest_orders where id=$1",
  [rpcShipping.orderId],
)).rows[0];

assert.equal(Number(storedShippingOrder.insurance_fee_cents), 250);
assert.equal(Number(storedShippingOrder.total_cents), 2500);

await as("postgres");
const rpcReservedCards = (await db.query(`
  select id,availability,guest_reserved_by,reserved_by
  from public.cards
  where id in ('guest-rpc-card-1','guest-rpc-card-2')
  order by id
`)).rows;

assert.equal(rpcReservedCards.length, 2);

for (const card of rpcReservedCards) {
  assert.equal(card.availability, "reserved");
  assert.ok(card.guest_reserved_by);
  assert.equal(card.reserved_by, null);
}

assert.equal(rpcReservedCards[0].guest_reserved_by, rpcFirst.orderId);
assert.equal(rpcReservedCards[1].guest_reserved_by, rpcShipping.orderId);

await as("authenticated", owner);
const rpcSettingsAfter = (await db.query(
  "select data,updated_at from public.store_settings where id=true"
)).rows[0];

await db.query(
  "select public.cms_save_settings($1,$2)",
  [
    {
      ...rpcSettingsAfter.data,
      guestCheckoutEnabled: false,
      shippingFeeCents: null,
    },
    rpcSettingsAfter.updated_at,
  ],
);

console.log("Guest Checkout reservation RPC checks passed.");

// Guest Checkout rollback safety tests
await addCard("guest-rollback-card-1");
await addCard("guest-rollback-card-2");

await as("authenticated", owner);
const rollbackSettingsBefore = (await db.query(
  "select data,updated_at from public.store_settings where id=true"
)).rows[0];

await db.query(
  "select public.cms_save_settings($1,$2)",
  [{
    ...rollbackSettingsBefore.data,
    guestCheckoutEnabled: true,
    shippingFeeCents: null,
  }, rollbackSettingsBefore.updated_at],
);

const rollbackRequest = (cardIds, overrides = {}) => ({
  requestKey: crypto.randomUUID(),
  name: "Rollback Customer",
  email: "rollback@example.test",
  fulfillmentMethod: "pickup",
  shippingService: null,
  insuranceSelected: false,
  cardIds,
  ...overrides,
});

await as("service_role");

const rollbackMixedKey = crypto.randomUUID();

await assert.rejects(
  db.query(
    "select public.cms_begin_guest_checkout($1)",
    [rollbackRequest(
      ["guest-rollback-card-1", "guest-rpc-card-1"],
      { requestKey: rollbackMixedKey },
    )],
  ),
  /no longer available/,
  "Mixed available and reserved cards must fail together",
);

await as("postgres");

const mixedOrderCount = (await db.query(
  "select count(*)::int as count from public.guest_orders where request_key=$1",
  [rollbackMixedKey],
)).rows[0].count;

assert.equal(mixedOrderCount, 0, "Failed cart creates no guest order");

const rollbackCardAfterFailure = (await db.query(`
  select availability,guest_reserved_by
  from public.cards
  where id='guest-rollback-card-1'
`)).rows[0];

assert.equal(rollbackCardAfterFailure.availability, "available");
assert.equal(rollbackCardAfterFailure.guest_reserved_by, null);

await as("service_role");

const missingShippingKey = crypto.randomUUID();

await assert.rejects(
  db.query(
    "select public.cms_begin_guest_checkout($1)",
    [rollbackRequest(["guest-rollback-card-1"], {
      requestKey: missingShippingKey,
      fulfillmentMethod: "shipping",
      shippingService: "invalid",
      insuranceSelected: false,
      shippingAddress: {
        line1: "123 Test Street",
        city: "Sydney",
        postalCode: "2000",
        country: "Australia",
      },
    })],
  ),
  /Select a valid shipping service/,
  "Invalid shipping services cannot reserve inventory",
);

const duplicateCardKey = crypto.randomUUID();

await assert.rejects(
  db.query(
    "select public.cms_begin_guest_checkout($1)",
    [rollbackRequest(
      ["guest-rollback-card-1", "guest-rollback-card-1"],
      { requestKey: duplicateCardKey },
    )],
  ),
  /unique cards/,
  "Duplicate cards cannot create reservations",
);

await as("postgres");

const failedOrders = (await db.query(
  "select count(*)::int as count from public.guest_orders where request_key=any($1::uuid[])",
  [[missingShippingKey, duplicateCardKey]],
)).rows[0].count;

assert.equal(failedOrders, 0, "Failed requests create no orders");

const rollbackCardFinal = (await db.query(`
  select availability,guest_reserved_by
  from public.cards
  where id='guest-rollback-card-1'
`)).rows[0];

assert.equal(rollbackCardFinal.availability, "available");
assert.equal(rollbackCardFinal.guest_reserved_by, null);

await as("authenticated", owner);
const rollbackSettingsAfter = (await db.query(
  "select data,updated_at from public.store_settings where id=true"
)).rows[0];

await db.query(
  "select public.cms_save_settings($1,$2)",
  [{
    ...rollbackSettingsAfter.data,
    guestCheckoutEnabled: false,
    shippingFeeCents: null,
  }, rollbackSettingsAfter.updated_at],
);

console.log("Guest Checkout rollback safety checks passed.");

// Guest Card Protection tests
await as("postgres");

const protectedCard = (await db.query(`
  select id,price_cents,publication,availability,
         reserved_by,guest_reserved_by
  from public.cards
  where id='guest-rpc-card-1'
`)).rows[0];

assert.ok(protectedCard.guest_reserved_by);

const protectedUpdate = async (sql) => {
  await assert.rejects(
    db.query(sql),
    /active Guest Checkout reservation/,
  );
};

await protectedUpdate(`
  update public.cards
  set price_cents=9999
  where id='guest-rpc-card-1'
`);

await protectedUpdate(`
  update public.cards
  set publication='archived'
  where id='guest-rpc-card-1'
`);

await protectedUpdate(`
  update public.cards
  set availability='available'
  where id='guest-rpc-card-1'
`);

await protectedUpdate(`
  update public.cards
  set guest_reserved_by=null
  where id='guest-rpc-card-1'
`);

await protectedUpdate(`
  update public.cards
  set reserved_by='11111111-1111-4111-8111-111111111111'
  where id='guest-rpc-card-1'
`);

const protectedCardAfter = (await db.query(`
  select price_cents,publication,availability,
         reserved_by,guest_reserved_by
  from public.cards
  where id='guest-rpc-card-1'
`)).rows[0];

assert.equal(protectedCardAfter.price_cents, protectedCard.price_cents);
assert.equal(protectedCardAfter.publication, protectedCard.publication);
assert.equal(protectedCardAfter.availability, "reserved");
assert.equal(protectedCardAfter.reserved_by, null);
assert.equal(
  protectedCardAfter.guest_reserved_by,
  protectedCard.guest_reserved_by,
);

// Unreserved cards must remain editable through the admin RPC.
await addCard("guest-protection-unreserved");

await as("authenticated", owner);
const editableCard = (await db.query(`
  select updated_at
  from public.cards
  where id='guest-protection-unreserved'
`)).rows[0];

await db.query(
  "select public.cms_save_card($1,$2)",
  [{
    id: "guest-protection-unreserved",
    name: "Editable Test Card",
    pokemonId: 6,
    set: "Base Set",
    year: 1999,
    number: "4/102",
    imageUrl: "/test.jpg",
    price: 20,
    publication: "published",
    availability: "available",
    featuredOrder: null,
  }, editableCard.updated_at],
);

await as("postgres");

const editedCard = (await db.query(`
  select price_cents,availability
  from public.cards
  where id='guest-protection-unreserved'
`)).rows[0];

assert.equal(editedCard.price_cents, 2000);
assert.equal(editedCard.availability, "available");

console.log("Guest Card Protection checks passed.");

// Guest Admin Card Safety tests
const adminCardPayload = (id, overrides = {}) => ({
  id,
  name: id,
  pokemonId: 6,
  set: "Base Set",
  year: 1999,
  number: "4/102",
  imageUrl: "/test.jpg",
  price: 12.5,
  publication: "published",
  availability: "reserved",
  featuredOrder: null,
  ...overrides,
});

await as("authenticated", owner);

const guestAdminCard = (await db.query(`
  select updated_at
  from public.cards
  where id='guest-rpc-card-1'
`)).rows[0];

for (const [description, changes] of [
  ["price", { price: 99 }],
  ["publication", { publication: "archived" }],
  ["availability", { availability: "available" }],
]) {
  await assert.rejects(
    db.query(
      "select public.cms_save_card($1,$2)",
      [
        adminCardPayload("guest-rpc-card-1", changes),
        guestAdminCard.updated_at,
      ],
    ),
    /active Guest Checkout reservation/,
    `Admin cannot change Guest-reserved card ${description}`,
  );
}

await as("postgres");

const guestAdminAfter = (await db.query(`
  select price_cents,publication,availability,guest_reserved_by
  from public.cards
  where id='guest-rpc-card-1'
`)).rows[0];

assert.equal(guestAdminAfter.price_cents, 1250);
assert.equal(guestAdminAfter.publication, "published");
assert.equal(guestAdminAfter.availability, "reserved");
assert.equal(guestAdminAfter.guest_reserved_by, rpcFirst.orderId);

// Existing Hold protection must remain functional.
await addCard("guest-admin-hold-card");
const adminSafetyHoldId = await acceptedHold("guest-admin-hold-card");

await as("authenticated", owner);

const holdAdminCard = (await db.query(`
  select updated_at
  from public.cards
  where id='guest-admin-hold-card'
`)).rows[0];

await assert.rejects(
  db.query(
    "select public.cms_save_card($1,$2)",
    [
      adminCardPayload("guest-admin-hold-card", {
        availability: "available",
      }),
      holdAdminCard.updated_at,
    ],
  ),
  /accepted hold request/,
  "Existing Hold reservation protection remains functional",
);

await as("postgres");

const holdAdminAfter = (await db.query(`
  select availability,reserved_by,guest_reserved_by
  from public.cards
  where id='guest-admin-hold-card'
`)).rows[0];

assert.equal(holdAdminAfter.availability, "reserved");
assert.equal(holdAdminAfter.reserved_by, adminSafetyHoldId);
assert.equal(holdAdminAfter.guest_reserved_by, null);

console.log("Guest Admin Card Safety checks passed.");

// Guest late-payment review regression
await as("postgres");
await addCard("guest-late-payment-card");
await as("postgres");

const latePaymentOrderId = (await db.query(`
  insert into public.guest_orders (
    request_key,
    name,
    email,
    fulfillment_method,
    currency,
    subtotal_cents,
    shipping_fee_cents,
    total_cents,
    status,
    expires_at
  )
  values (
    $1,
    'Late Payment Customer',
    'late-payment@example.test',
    'pickup',
    'AUD',
    1250,
    0,
    1250,
    'expired',
    clock_timestamp() - interval '1 hour'
  )
  returning id
`, [crypto.randomUUID()])).rows[0].id;

await db.query(`
  insert into public.guest_order_items (
    order_id,
    card_id,
    name,
    price_cents
  )
  values ($1,'guest-late-payment-card','Late Payment Test Card',1250)
`, [latePaymentOrderId]);

const latePaymentAttemptId = (await db.query(`
  insert into public.guest_payment_attempts (
    order_id,
    idempotency_key,
    checkout_session_id,
    amount_cents,
    currency,
    status
  )
  values ($1,$2,'cs_test_guest_late_payment',1250,'aud','expired')
  returning id
`, [latePaymentOrderId, crypto.randomUUID()])).rows[0].id;

await as("service_role");

assert.equal(
  (await db.query(
    "select public.cms_record_guest_stripe_webhook($1,$2,$3,$4,$5,$6,$7) as ok",
    [
      "evt_guest_late_payment_success",
      "checkout.session.completed",
      latePaymentAttemptId,
      "cs_test_guest_late_payment",
      "pi_test_guest_late_payment",
      "success",
      null,
    ],
  )).rows[0].ok,
  true,
  "Late successful Guest payment is acknowledged for manual review",
);

await as("postgres");

const latePaymentOrder = (await db.query(`
  select status,paid_at
  from public.guest_orders
  where id=$1
`, [latePaymentOrderId])).rows[0];

assert.equal(latePaymentOrder.status, "payment_review");
assert.ok(latePaymentOrder.paid_at);

const latePaymentAttempt = (await db.query(`
  select status,payment_intent_id,failure_reason
  from public.guest_payment_attempts
  where id=$1
`, [latePaymentAttemptId])).rows[0];

assert.equal(latePaymentAttempt.status, "paid");
assert.equal(
  latePaymentAttempt.payment_intent_id,
  "pi_test_guest_late_payment",
);
assert.match(
  latePaymentAttempt.failure_reason,
  /manual review required/,
);

const latePaymentCard = (await db.query(`
  select availability,reserved_by,guest_reserved_by
  from public.cards
  where id='guest-late-payment-card'
`)).rows[0];

assert.equal(
  latePaymentCard.availability,
  "available",
  "Late payment must not reclaim released inventory",
);
assert.equal(latePaymentCard.reserved_by, null);
assert.equal(latePaymentCard.guest_reserved_by, null);

console.log("Guest Late Payment Review checks passed.");

// Guest Checkout rate-limit integrity tests
await as("postgres");
await db.exec("delete from public.guest_checkout_rate_limits");

const guestRateLimit = async (requestKey, ipHash, emailHash) => {
  const result = await db.query(
    "select public.cms_check_guest_checkout_rate_limit($1,$2,$3) as allowed",
    [requestKey, ipHash, emailHash],
  );
  return result.rows[0].allowed;
};

const rateIpA = "a".repeat(64);
const rateIpB = "b".repeat(64);
const rateEmailA = "c".repeat(64);
const rateEmailB = "d".repeat(64);

await as("service_role");

// Same request key + same identity is idempotent.
const idempotentKey = crypto.randomUUID();
assert.equal(
  await guestRateLimit(idempotentKey, rateIpA, rateEmailA),
  true,
);
assert.equal(
  await guestRateLimit(idempotentKey, rateIpA, rateEmailA),
  true,
);

const idempotentRows = (await db.query(
  "select count(*)::int as count from public.guest_checkout_rate_limits where request_key=$1",
  [idempotentKey],
)).rows[0].count;

assert.equal(
  idempotentRows,
  1,
  "Exact Guest Checkout retry consumes only one rate-limit row",
);

// A reused request key cannot be rebound to another identity.
await assert.rejects(
  guestRateLimit(idempotentKey, rateIpB, rateEmailA),
  /request key was already used/,
  "Guest Checkout request key cannot move to another IP",
);

await assert.rejects(
  guestRateLimit(idempotentKey, rateIpA, rateEmailB),
  /request key was already used/,
  "Guest Checkout request key cannot move to another email",
);

// Email bucket allows four attempts in 15 minutes and rejects the fifth.
const emailLimitHash = "e".repeat(64);
for (let i = 0; i < 4; i += 1) {
  assert.equal(
    await guestRateLimit(
      crypto.randomUUID(),
      String(i + 1).repeat(64).slice(0, 64),
      emailLimitHash,
    ),
    true,
  );
}

assert.equal(
  await guestRateLimit(
    crypto.randomUUID(),
    "f".repeat(64),
    emailLimitHash,
  ),
  false,
  "Guest Checkout email bucket rejects attempt five",
);

// IP bucket allows eight attempts in 15 minutes and rejects the ninth.
const ipLimitHash = "9".repeat(64);
for (let i = 0; i < 8; i += 1) {
  const emailHash = (i + 1).toString(16).padStart(64, String((i + 2) % 10));

  assert.equal(
    await guestRateLimit(
      crypto.randomUUID(),
      ipLimitHash,
      emailHash,
    ),
    true,
  );
}

assert.equal(
  await guestRateLimit(
    crypto.randomUUID(),
    ipLimitHash,
    "8".repeat(64),
  ),
  false,
  "Guest Checkout IP bucket rejects attempt nine",
);

// Old anti-abuse rows are pruned when the limiter runs.
await as("postgres");

const staleRateKey = crypto.randomUUID();
await db.query(
  `insert into public.guest_checkout_rate_limits(
    request_key,
    ip_hash,
    email_hash,
    created_at
  )
  values($1,$2,$3,clock_timestamp() - interval '25 hours')`,
  [staleRateKey, "1".repeat(64), "2".repeat(64)],
);

await as("service_role");

assert.equal(
  await guestRateLimit(
    crypto.randomUUID(),
    "3".repeat(64),
    "4".repeat(64),
  ),
  true,
);

const staleRows = (await db.query(
  "select count(*)::int as count from public.guest_checkout_rate_limits where request_key=$1",
  [staleRateKey],
)).rows[0].count;

assert.equal(
  staleRows,
  0,
  "Guest Checkout rate-limit rows older than 24 hours are removed",
);

console.log("Guest Checkout Rate Limit checks passed.");

// ── Holds record a delivery address ───────────────────────────────────────
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
await addCard("phase4-card-17");
await as("service_role");
const postal = { method: "post", recipient: " Ash Ketchum ", phone: "0400 000 000", line1: "1 Pallet St", line2: "", suburb: "Fitzroy", state: "vic", postcode: "3065" };
const postHoldId = (await db.query("select public.cms_submit_hold($1,$2,$3) as id", [{
  name: "Test customer", email: "customer@example.test", note: "", cardIds: ["phase4-card-17"], prices: { "phase4-card-17": 1250 }, requestKey: crypto.randomUUID(), delivery: postal,
}, "phase4-test-ip-2", customer])).rows[0].id;
await as("postgres");
const saved = (await db.query("select delivery from public.hold_requests where id=$1", [postHoldId])).rows[0].delivery;
assert.equal(saved.recipient, "Ash Ketchum");
assert.equal(saved.state, "VIC");
assert.equal(saved.country, "Australia");
await as("service_role");
await assert.rejects(
  db.query("select public.cms_submit_hold($1,$2,$3)", [{
    name: "Test customer", email: "customer@example.test", note: "", cardIds: ["phase4-card-1"], prices: {}, requestKey: crypto.randomUUID(), delivery: { ...postal, postcode: "30" },
  }, "phase4-test-ip-3", customer]),
  /Check your delivery address/,
);

// ── The store can delete requests that never became a sale ────────────────
await as("authenticated", owner);
await assert.rejects(db.query("select public.cms_delete_hold($1)", [emailHoldId]), /Cancel it before deleting/);
await db.query("select public.cms_transition_hold($1,'rejected')", [postHoldId]);
// The decline email is still queued, so the request can't be deleted yet.
await assert.rejects(db.query("select public.cms_delete_hold($1)", [postHoldId]), /still being sent/);
await as("postgres");
await db.query("update public.notification_outbox set status='sent', sent_at=now() where hold_id=$1", [postHoldId]);
await as("authenticated", customer);
await assert.rejects(db.query("select public.cms_delete_hold($1)", [postHoldId]), /Administrator access required/);
await as("authenticated", owner);
await db.query("select public.cms_delete_hold($1)", [postHoldId]);
await as("postgres");
assert.equal((await db.query("select count(*)::int as n from public.hold_requests where id=$1", [postHoldId])).rows[0].n, 0);
assert.equal((await db.query("select count(*)::int as n from public.hold_request_items where request_id=$1", [postHoldId])).rows[0].n, 0);
assert.equal((await db.query("select count(*)::int as n from public.hold_status_history where hold_id=$1", [postHoldId])).rows[0].n, 0);
assert.equal((await db.query("select count(*)::int as n from public.audit_log where table_name='hold_requests' and record_id=$1 and new_data is null", [postHoldId])).rows[0].n, 1);
const paidHold = (await db.query("select id from public.hold_requests where payment_status='paid' limit 1")).rows[0];
assert.ok(paidHold, "An earlier check leaves a paid hold to test against");
await as("authenticated", owner);
await assert.rejects(db.query("select public.cms_delete_hold($1)", [paidHold.id]), /kept for your records|Cancel it before deleting/);

// ── Deadline notes use Melbourne time ─────────────────────────────────────
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
await addCard("phase4-card-18");
const extendId = await acceptedHold("phase4-card-18");
await as("authenticated", owner);
const newDeadline = new Date(Date.now() + 3 * 86_400_000);
newDeadline.setUTCMinutes(30, 0, 0);
await db.query("select public.cms_set_hold_deadline($1,$2)", [extendId, newDeadline.toISOString()]);
await as("postgres");
const extendNote = (await db.query("select note from public.hold_status_history where hold_id=$1 and note like 'Deadline%' order by id desc limit 1", [extendId])).rows[0].note;
const melbourne = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(newDeadline).map((p) => [p.type, p.value]));
assert.equal(extendNote, `Deadline extended to ${melbourne.day} ${melbourne.month} ${melbourne.year}, ${melbourne.hour}:${melbourne.minute} ${melbourne.dayPeriod.toUpperCase()} Melbourne time`);

// ── Status emails know what changed ───────────────────────────────────────
await as("postgres");
await db.exec("delete from public.hold_rate_limits");
await addCard("phase4-card-19");
const mailHoldId = await acceptedHold("phase4-card-19");
const latestMail = async () => (await db.query("select payload from public.notification_outbox where hold_id=$1 and kind='customer_status_changed' order by id desc limit 1", [mailHoldId])).rows[0].payload;
const mailCount = async () => (await db.query("select count(*)::int as n from public.notification_outbox where hold_id=$1 and kind='customer_status_changed'", [mailHoldId])).rows[0].n;
await as("postgres");
const beforeNote = await mailCount();
await as("authenticated", owner);
await db.query("select public.cms_set_hold_workflow($1,null,null,null,null,$2)", [mailHoldId, "Packing tomorrow"]);
await as("postgres");
assert.equal(await mailCount(), beforeNote, "A note on an unpaid hold doesn't re-send the reserved email");
await as("authenticated", owner);
await db.query("select public.cms_set_hold_workflow($1,null,'paid',null,'manual',null)", [mailHoldId]);
await db.query("select public.cms_set_hold_workflow($1,null,'refunded',null,null,null)", [mailHoldId]);
await as("postgres");
assert.equal((await latestMail()).refundedNow, true);
await as("authenticated", owner);
await db.query("select public.cms_set_hold_workflow($1,'cancelled',null,null,null,null)", [mailHoldId]);
await as("postgres");
const closing = await latestMail();
assert.equal(closing.status, "cancelled");
assert.equal(closing.statusChanged, true);
assert.equal(closing.refundedNow, false);


await db.close();
console.log("Phase 4 payment checks passed: payment flow, webhook safety, deadline reconciliation, and inventory protection during active Checkout, payment integrity guards, workflow integrity, order alert routing, delivery addresses, hold deletion and status email changes.");
