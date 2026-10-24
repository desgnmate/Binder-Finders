import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (process.env.PHASE3_TEST_ALLOW_MUTATIONS !== "true") {
  throw new Error(
    "Set PHASE3_TEST_ALLOW_MUTATIONS=true to run the disposable live Phase 3 check",
  );
}

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const suffix = randomUUID();
const email = `phase3-verification-${suffix}@example.test`;
const password = `${randomUUID()}-Aa1!`;
const cardId = `phase3-verification-${suffix}`;
let userId;
let holdId;
const check = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

try {
  const created = check(
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    }),
  );
  userId = created.user.id;
  check(
    await service.from("admin_users").insert({
      user_id: userId,
      email,
      role: "editor",
      active: true,
    }),
  );
  check(
    await service.from("cards").insert({
      id: cardId,
      data: { name: "Phase 3 verification card" },
      price_cents: 1250,
      publication: "published",
      availability: "available",
    }),
  );
  holdId = check(
    await service
      .from("hold_requests")
      .insert({
        request_key: randomUUID(),
        name: "Phase 3 verification customer",
        email: `customer-${suffix}@example.test`,
        note: "Disposable Phase 3 fixture",
        currency: "AUD",
      })
      .select("id")
      .single(),
  ).id;
  check(
    await service.from("hold_request_items").insert({
      request_id: holdId,
      card_id: cardId,
      name: "Phase 3 verification card",
      price_cents: 1250,
    }),
  );

  check(await admin.auth.signInWithPassword({ email, password }));
  const queued = check(
    await service
      .from("notification_outbox")
      .select("kind,status")
      .eq("hold_id", holdId)
      .order("id"),
  );
  assert.ok(
    queued.some((row) => row.kind === "customer_request_received"),
    "A new hold must queue a customer receipt",
  );
  assert.ok(
    queued.some((row) => row.kind === "staff_request_received"),
    "A new hold must queue a staff notification",
  );

  check(
    await admin.rpc("cms_set_hold_workflow", {
      p_id: holdId,
      p_status: "accepted",
      p_payment_status: "unpaid",
      p_fulfillment_status: "not_ready",
      p_payment_reference: null,
      p_fulfillment_note: null,
    }),
  );
  const reserved = check(
    await service
      .from("hold_requests")
      .select("status,payment_status,fulfillment_status")
      .eq("id", holdId)
      .single(),
  );
  assert.deepEqual(reserved, {
    status: "accepted",
    payment_status: "unpaid",
    fulfillment_status: "not_ready",
  });

  const blocked = await admin.rpc("cms_set_hold_workflow", {
    p_id: holdId,
    p_status: "completed",
    p_payment_status: "unpaid",
    p_fulfillment_status: "not_ready",
    p_payment_reference: null,
    p_fulfillment_note: null,
  });
  assert.match(blocked.error?.message || "", /Record payment/);

  check(
    await admin.rpc("cms_set_hold_workflow", {
      p_id: holdId,
      p_status: "completed",
      p_payment_status: "paid",
      p_fulfillment_status: "ready",
      p_payment_reference: "phase3-test",
      p_fulfillment_note: "Disposable fixture",
    }),
  );
  const completed = check(
    await service
      .from("hold_requests")
      .select("status,payment_status,fulfillment_status")
      .eq("id", holdId)
      .single(),
  );
  assert.deepEqual(completed, {
    status: "completed",
    payment_status: "paid",
    fulfillment_status: "ready",
  });
  assert.equal(
    check(
      await service
        .from("cards")
        .select("availability")
        .eq("id", cardId)
        .single(),
    ).availability,
    "sold",
  );
  const finalQueue = check(
    await service
      .from("notification_outbox")
      .select("kind")
      .eq("hold_id", holdId),
  );
  assert.ok(
    finalQueue.filter((row) => row.kind === "customer_status_changed").length >= 2,
    "Status transitions must queue customer updates",
  );
  console.log("Live Phase 3 checks passed: notification outbox, staff/customer queueing, guarded completion, reservation and sale workflow.");
} finally {
  await admin.auth.signOut();
  if (holdId) {
    await service.from("hold_request_items").delete().eq("request_id", holdId);
    await service.from("hold_requests").delete().eq("id", holdId);
  }
  await service.from("cards").delete().eq("id", cardId);
  if (userId) {
    await service.from("audit_log").delete().eq("record_id", userId);
    await service.from("admin_users").delete().eq("user_id", userId);
    await service.auth.admin.deleteUser(userId);
  }
}
