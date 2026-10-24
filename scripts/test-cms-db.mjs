import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/202609160001_cms.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/202609230001_customer_holds.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/202609240001_phase3_workflow_notifications.sql", import.meta.url),
    "utf8",
  ),
);
const owner = "11111111-1111-4111-8111-111111111111";
await db.exec(await readFile(new URL("../supabase/migrations/202609250001_workflow_delivery_safety.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../supabase/migrations/202609260001_phase3_hold_management.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../supabase/migrations/202609270001_phase4_stripe_payments.sql", import.meta.url), "utf8"));
const editor = "22222222-2222-4222-8222-222222222222";
await db.query(
  `insert into auth.users(id,email,email_confirmed_at) values($1,'owner@example.test',now()),($2,'editor@example.test',now());`,
  [owner, editor],
);
await db.query(
  `insert into public.admin_users(user_id,email,role) values($1,'owner@example.test','owner'),($2,'editor@example.test','editor')`,
  [owner, editor],
);
await db.query(`insert into public.store_settings(data) values($1)`, [
  { currency: "AUD", holdsEnabled: true, content: {} },
]);
async function as(role, id = "") {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec(`set role ${role}`);
}
const card = {
  id: "test-card",
  name: "Test card",
  pokemonId: 6,
  set: "Base Set",
  year: 1999,
  number: "4/102",
  imageUrl: "/test.jpg",
  price: 10,
  publication: "draft",
  availability: "available",
  featuredOrder: null,
};
await as("authenticated", owner);
await db.query("select public.cms_save_card($1,null)", [card]);
await as("anon");
assert.equal(
  (await db.query("select * from public.cards")).rows.length,
  0,
  "Draft must not be public",
);
await assert.rejects(
  db.query("select public.cms_save_card($1,null)", [card]),
  /permission denied/,
);
await as("authenticated", "33333333-3333-4333-8333-333333333333");
await assert.rejects(
  db.query("select public.cms_save_card($1,null)", [card]),
  /Administrator access required/,
);
assert.equal(
  (await db.query("select * from public.hold_requests")).rows.length,
  0,
);
await as("authenticated", owner);
let row = (await db.query("select * from public.cards")).rows[0];
await assert.rejects(
  db.query("update public.cards set price_cents=1"),
  /permission denied/,
);
await assert.rejects(
  db.query("select public.cms_save_card($1,null)", [card]),
  /another session/,
);
card.publication = "published";
await db.query("select public.cms_save_card($1,$2)", [card, row.updated_at]);
await as("anon");
assert.equal((await db.query("select * from public.cards")).rows.length, 1);
await assert.rejects(
  db.query("select public.cms_submit_hold($1,$2)", [{}, "test"]),
  /permission denied/,
);
await as("postgres");
const request = {
  name: "Test buyer",
  email: "buyer@example.test",
  note: "",
  cardIds: ["test-card"],
  prices: { "test-card": 1000 },
  requestKey: crypto.randomUUID(),
};
await assert.rejects(
  db.query("select public.cms_submit_hold($1,$2)", [
    { ...request, prices: { "test-card": 1 } },
    "test-ip",
  ]),
  /price changed/,
);
const first = (
  await db.query("select public.cms_submit_hold($1,$2) as id", [
    request,
    "test-ip",
  ])
).rows[0].id;
assert.equal(
  (
    await db.query("select public.cms_submit_hold($1,$2) as id", [
      request,
      "test-ip",
    ])
  ).rows[0].id,
  first,
  "Retry must not duplicate a request",
);
const second = (
  await db.query("select public.cms_submit_hold($1,$2) as id", [
    { ...request, requestKey: crypto.randomUUID() },
    "test-ip",
  ])
).rows[0].id;
const queuedNotifications = await db.query(
  "select kind,payload from public.notification_outbox where hold_id=$1 order by id",
  [first],
);
assert.equal(queuedNotifications.rows[0].kind, "customer_request_received");
assert.equal(queuedNotifications.rows[0].payload.items.length, 1);
await as("authenticated", owner);
await db.query("select public.cms_transition_hold($1,'accepted')", [first]);
await assert.rejects(
  db.query("select public.cms_transition_hold($1,'accepted')", [second]),
  /no longer available/,
);
row = (await db.query("select * from public.cards")).rows[0];
await assert.rejects(
  db.query("select public.cms_save_card($1,$2)", [
    { ...card, price: 11, availability: "reserved" },
    row.updated_at,
  ]),
  /accepted hold request/,
);
await db.query("select public.cms_transition_hold($1,'cancelled')", [first]);
assert.equal(
  (await db.query("select availability from public.cards")).rows[0]
    .availability,
  "available",
);
await db.query("select public.cms_transition_hold($1,'accepted')", [second]);
await assert.rejects(
  db.query("select public.cms_transition_hold($1,'completed')", [second]),
  /Record payment/,
  "Legacy RPC must not bypass payment guard",
);
assert.equal((await db.query("select availability from public.cards")).rows[0].availability, "reserved", "Failed completion must roll back inventory changes");
await assert.rejects(
  db.query("select public.cms_set_hold_workflow($1,'completed','unpaid','not_ready',null,null)", [second]),
  /Record payment/,
);
await db.query(
  "select public.cms_set_hold_workflow($1,null,'paid','ready','manual-test','Packed for pickup')",
  [second],
);
await as("postgres");
let notifications = (await db.query("select * from public.notification_outbox where hold_id=$1 and kind='customer_status_changed' order by id", [second])).rows;
assert.equal(notifications.at(-1).payload.paymentStatus, "paid", "Payment-only update must notify customer");
assert.equal(notifications.at(-1).payload.fulfillmentStatus, "ready");
const beforeCompletion = notifications.length;
await as("authenticated", owner);
await db.query(
  "select public.cms_set_hold_workflow($1,'completed','paid','shipped','manual-test','Tracking 123')",
  [second],
);
assert.equal(
  (await db.query("select availability from public.cards")).rows[0]
    .availability,
  "sold",
);
await as("postgres");
notifications = (await db.query("select * from public.notification_outbox where hold_id=$1 and kind='customer_status_changed' order by id", [second])).rows;
assert.equal(notifications.length, beforeCompletion + 1, "Combined state and metadata change must queue one final update");
assert.equal(notifications.at(-1).payload.status, "completed");
assert.equal(notifications.at(-1).payload.fulfillmentStatus, "shipped");
await as("authenticated", owner);
await db.query("select public.cms_set_hold_workflow($1,null,null,'delivered',null,'Delivered')", [second]);
await db.query("select public.cms_set_hold_workflow($1,null,'refunded',null,'refund-123',null)", [second]);
await assert.rejects(db.query("select public.cms_set_hold_workflow($1,null,'unpaid',null,null,null)", [second]), /must remain paid/);
assert.equal((await db.query("select availability from public.cards")).rows[0].availability, "sold", "Recording a refund must not silently relist a card");
await as("postgres");
const beforeNoop = (await db.query("select count(*)::int as n from public.notification_outbox")).rows[0].n;
await as("authenticated", owner);
await db.query("select public.cms_set_hold_workflow($1,null,null,null,null,null)", [second]);
await as("postgres");
assert.equal((await db.query("select count(*)::int as n from public.notification_outbox")).rows[0].n, beforeNoop, "No-op workflow saves must not notify");
await as("authenticated", owner);
await assert.rejects(
  db.query("select public.cms_transition_hold($1,'cancelled')", [second]),
  /Invalid request transition/,
);
await assert.rejects(
  db.query("select public.cms_set_admin($1,$2,$3,$4)", [
    owner,
    "owner@example.test",
    "editor",
    false,
  ]),
  /own access/,
);
await as("authenticated", editor);
const collection = {
  id: "test-collection",
  name: "Test collection",
  sortOrder: 1,
  cardIds: ["test-card"],
};
await db.query("select public.cms_save_collection($1,null)", [collection]);
const collectionRow = (
  await db.query("select * from public.collections where id='test-collection'")
).rows[0];
await assert.rejects(
  db.query("select public.cms_save_collection($1,null)", [collection]),
  /Collection changed/,
);
await assert.rejects(
  db.query("select public.cms_save_collection($1,$2)", [
    { ...collection, cardIds: ["missing-card"] },
    collectionRow.updated_at,
  ]),
  /foreign key/,
);
assert.equal(
  (
    await db.query(
      "select card_id from public.collection_cards where collection_id='test-collection'",
    )
  ).rows[0].card_id,
  "test-card",
  "Failed membership edits must roll back",
);
const currentSettings = (await db.query("select * from public.store_settings"))
  .rows[0];
await assert.rejects(
  db.query("select public.cms_save_settings($1,$2)", [
    { ...currentSettings.data, currency: "USD" },
    currentSettings.updated_at,
  ]),
  /Only an owner/,
);
await db.query("select public.cms_save_settings($1,$2)", [
  { ...currentSettings.data, content: { heroLine1: "Edited content" } },
  currentSettings.updated_at,
]);
await assert.rejects(
  db.query("select public.cms_save_settings($1,$2)", [
    currentSettings.data,
    currentSettings.updated_at,
  ]),
  /Settings changed/,
);
await assert.rejects(
  db.query("select public.cms_set_admin($1,$2,$3,$4)", [
    owner,
    "owner@example.test",
    "editor",
    false,
  ]),
  /Owner access required/,
);
assert.ok(
  (await db.query("select * from public.audit_log")).rows.length > 5,
  "Changes are audited",
);
await as("anon");
await assert.rejects(
  db.query("select * from public.hold_requests"),
  /permission denied/,
);
await assert.rejects(
  db.query("select * from public.admin_users"),
  /permission denied/,
);
await assert.rejects(db.query("select * from public.cms_claim_notification_outbox(1)"), /permission denied/);
await as("authenticated", owner);
await assert.rejects(db.query("select * from public.cms_claim_notification_outbox(1)"), /permission denied/);
await as("service_role");
let claimed = (await db.query("select * from public.cms_claim_notification_outbox(1)")).rows[0];
const frozenBody = { from: "sender@example.test", to: [claimed.to_email], subject: "Original", text: "Receipt" };
assert.deepEqual((await db.query("select public.cms_prepare_notification($1,$2,$3) as body", [claimed.id, claimed.claim_token, frozenBody])).rows[0].body, frozenBody);
const otherClaim = (await db.query("select * from public.cms_claim_notification_outbox(1)")).rows[0];
assert.notEqual(claimed.id, otherClaim.id, "Live lease must not be claimed twice");
await as("postgres");
await db.query("update public.notification_outbox set leased_at=now()-interval '6 minutes' where id=$1", [claimed.id]);
await as("service_role");
const recovered = (await db.query("select * from public.cms_claim_notification_outbox(1)")).rows[0];
assert.equal(recovered.id, claimed.id, "Recover a crashed worker's expired lease");
assert.notEqual(recovered.claim_token, claimed.claim_token);
assert.deepEqual(recovered.delivery_body, frozenBody);
assert.equal((await db.query("select public.cms_finish_notification($1,$2,true,null) as ok", [claimed.id, claimed.claim_token])).rows[0].ok, false, "Stale worker cannot acknowledge a newer lease");
assert.deepEqual((await db.query("select public.cms_prepare_notification($1,$2,$3) as body", [recovered.id, recovered.claim_token, { ...frozenBody, subject: "Changed template" }])).rows[0].body, frozenBody, "Retries preserve provider request");
assert.equal((await db.query("select public.cms_finish_notification($1,$2,true,null) as ok", [recovered.id, recovered.claim_token])).rows[0].ok, true);
assert.equal((await db.query("select public.cms_finish_notification($1,$2,false,'late error') as ok", [recovered.id, recovered.claim_token])).rows[0].ok, false);
claimed = (await db.query("select * from public.cms_claim_notification_outbox(1)")).rows[0];
assert.equal((await db.query("select public.cms_finish_notification($1,$2,false,'provider unavailable') as ok", [claimed.id, claimed.claim_token])).rows[0].ok, true);
let retry = (await db.query("select * from public.notification_outbox where id=$1", [claimed.id])).rows[0];
assert.equal(retry.status, "pending");
assert.ok(new Date(retry.available_at) > new Date(), "Failures back off");
await as("postgres");
await db.query("update public.notification_outbox set attempts=5,available_at=now()-interval '1 minute' where id=$1", [claimed.id]);
await db.query("update public.notification_outbox set leased_at=now()-interval '1 day',first_attempt_at=now()-interval '1 day' where id=$1", [otherClaim.id]);
await as("service_role");
const nextBatch = (await db.query("select * from public.cms_claim_notification_outbox(20)")).rows;
assert.ok(nextBatch.every(row => row.id !== claimed.id && row.id !== otherClaim.id));
assert.equal((await db.query("select status from public.notification_outbox where id=$1", [otherClaim.id])).rows[0].status, "failed", "Ambiguous deliveries beyond provider dedup window require review");
assert.equal((await db.query("select status from public.notification_outbox where id=$1", [claimed.id])).rows[0].status, "failed", "Exhausted retries must terminate");
await db.close();
console.log(
  "CMS database checks passed: migration, draft privacy, authorization, stale edits, pricing, idempotency, conflicting holds, cancellation, sale completion, role protection, audit log.",
);
