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
for (const file of migrations) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
}

const owner = "11111111-1111-4111-8111-111111111111";
const customer = "33333333-3333-4333-8333-333333333333";
await db.query(
  `insert into auth.users(id,email,email_confirmed_at)
   values($1,'owner@example.test',now()),($2,'customer@example.test',now())`,
  [owner, customer],
);
await db.query(`insert into public.admin_users(user_id,email,role) values($1,'owner@example.test','owner')`, [owner]);
await db.query(`insert into public.store_settings(data) values($1)`, [{ currency: "AUD", holdsEnabled: true, holdDurationHours: 2, content: {} }]);

async function as(role, id = "") {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec(`set role ${role}`);
}

async function createPublishedCard(id) {
  const card = {
    id,
    name: `Test ${id}`,
    pokemonId: 6,
    set: "Base Set",
    year: 1999,
    number: "4/102",
    imageUrl: "/test.jpg",
    price: 10,
    publication: "published",
    availability: "available",
    featuredOrder: null,
  };
  await as("authenticated", owner);
  const current = (await db.query("select * from public.cards where id=$1", [id])).rows[0];
  await db.query("select public.cms_save_card($1,$2)", [card, current?.updated_at ?? null]);
  return card;
}

async function submit(cardId, requestKey = crypto.randomUUID()) {
  await as("service_role");
  return (await db.query("select public.cms_submit_hold($1,$2,$3) as id", [{
    name: "Test customer",
    email: "customer@example.test",
    note: "",
    cardIds: [cardId],
    prices: { [cardId]: 1000 },
    requestKey,
  }, "phase3-test-ip", customer])).rows[0].id;
}

const firstCard = "phase3-card-1";
await createPublishedCard(firstCard);
const firstHold = await submit(firstCard);

await as("authenticated", owner);
await db.query("select public.cms_transition_hold($1,'accepted')", [firstHold]);
let first = (await db.query("select status,approved_at,expires_at from public.hold_requests where id=$1", [firstHold])).rows[0];
assert.equal(first.status, "accepted");
assert.ok(first.approved_at);
assert.ok(new Date(first.expires_at) > new Date());
assert.ok(new Date(first.expires_at) <= new Date(Date.now() + 3 * 60 * 60 * 1000));

const extended = new Date(Date.now() + 5 * 60 * 60 * 1000);
await db.query("select public.cms_set_hold_deadline($1,$2)", [firstHold, extended.toISOString()]);
first = (await db.query("select expires_at from public.hold_requests where id=$1", [firstHold])).rows[0];
assert.ok(Math.abs(new Date(first.expires_at).getTime() - extended.getTime()) < 5000);
await assert.rejects(
  db.query("select public.cms_set_hold_deadline($1,$2)", [firstHold, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()]),
  /between now and 30 days/,
);

await as("authenticated", customer);
assert.equal((await db.query("select has_table_privilege(current_user,'public.hold_requests','select') as ok")).rows[0].ok, true, "Customer can read own hold rows");
assert.equal((await db.query("select count(*)::int as count from public.hold_requests where id=$1", [firstHold])).rows[0].count, 1, "Customer can read own hold");
await db.query("select public.cms_cancel_customer_hold($1)", [firstHold]);
await as("postgres");
assert.equal((await db.query("select status,expires_at from public.hold_requests where id=$1", [firstHold])).rows[0].status, "cancelled");
assert.equal((await db.query("select availability from public.cards where id=$1", [firstCard])).rows[0].availability, "available");
const cancelledEvent = (await db.query("select to_status,note from public.hold_status_history where hold_id=$1 order by id desc limit 1", [firstHold])).rows[0];
assert.equal(cancelledEvent.to_status, "cancelled");
assert.equal(cancelledEvent.note, "Cancelled by customer");

const expiryCard = "phase3-card-2";
await createPublishedCard(expiryCard);
const expiryHold = await submit(expiryCard);
await as("authenticated", owner);
await db.query("select public.cms_transition_hold($1,'accepted')", [expiryHold]);
await as("postgres");
await db.query("update public.hold_requests set expires_at=now()-interval '1 minute' where id=$1", [expiryHold]);
await as("service_role");
assert.equal((await db.query("select public.cms_expire_unpaid_holds(10) as count")).rows[0].count, 1);
await as("postgres");
assert.equal((await db.query("select status from public.hold_requests where id=$1", [expiryHold])).rows[0].status, "expired");
assert.equal((await db.query("select availability from public.cards where id=$1", [expiryCard])).rows[0].availability, "available");
const expiredEvent = (await db.query("select to_status,actor_kind from public.hold_status_history where hold_id=$1 order by id desc limit 1", [expiryHold])).rows[0];
assert.deepEqual(expiredEvent, { to_status: "expired", actor_kind: "system" });
assert.equal(
  (await db.query("select payload->>'status' as status from public.notification_outbox where hold_id=$1 and kind='customer_status_changed' order by id desc limit 1", [expiryHold])).rows[0].status,
  "expired",
  "Expiry queues a customer notification",
);

await db.close();
console.log("Phase 3 hold checks passed: configurable deadlines, history, customer cancellation, reservation release, and automatic expiry.");
