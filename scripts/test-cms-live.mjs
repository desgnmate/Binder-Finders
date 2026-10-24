import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// This workflow temporarily changes store settings: only run against an isolated
// test project and a dev server configured for that same project. Never production.
if (
  process.env.CMS_TEST_ALLOW_MUTATIONS !== "true" ||
  !url ||
  url === "https://zovjsqrcfcnptcihzmlw.supabase.co" ||
  !process.env.CMS_TEST_EMAIL?.startsWith("cms-verification-")
)
  throw new Error(
    "An isolated test project and explicit CMS_TEST_ALLOW_MUTATIONS=true are required",
  );
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const admin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { error: loginError } = await admin.auth.signInWithPassword({
  email: process.env.CMS_TEST_EMAIL,
  password: process.env.CMS_TEST_PASSWORD,
});
if (loginError) throw loginError;
const id = "cms-verification-rpc";
const requestIds = [];
const { data: originalSettings } = await service
  .from("store_settings")
  .select("*")
  .eq("id", true)
  .single();
const card = {
  id,
  name: "CMS verification — not for sale",
  pokemonId: 252,
  set: "Verification",
  year: 2003,
  number: "TEST",
  rarity: "Common",
  condition: "RAW NM",
  type: "Grass",
  price: 12.34,
  imageUrl: "/images/logo.png",
  backImageUrl: "",
  additionalImages: [],
  description: "Disposable verification fixture",
  publication: "draft",
  availability: "available",
  featuredOrder: null,
};
const check = async (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
try {
  await check(
    await admin.rpc("cms_save_card", { p_card: card, p_expected: null }),
  );
  assert.equal(
    (await anon.from("cards").select("id").eq("id", id)).data.length,
    0,
  );
  assert.ok(
    (await anon.from("cards").update({ price_cents: 1 }).eq("id", id)).error,
  );
  const draft = await check(
    await admin.from("cards").select("*").eq("id", id).single(),
  );
  await check(
    await admin.rpc("cms_save_card", {
      p_card: { ...card, publication: "published", price: 23.45 },
      p_expected: draft.updated_at,
    }),
  );
  const publicCard = await check(
    await anon.from("cards").select("*").eq("id", id).single(),
  );
  assert.equal(publicCard.price_cents, 2345);
  assert.ok(
    (
      await admin.rpc("cms_save_card", {
        p_card: card,
        p_expected: draft.updated_at,
      })
    ).error,
    "Stale edits must fail",
  );
  const page = await fetch("http://localhost:3102/shop?card=" + id);
  assert.ok((await page.text()).includes(id));
  const forbidden = await anon.from("hold_requests").select("*");
  assert.ok(forbidden.error);
  const prohibited = await anon.rpc("cms_submit_hold", {
    p_request: {},
    p_ip_hash: "test",
  });
  assert.ok(prohibited.error);
  await check(
    await admin.rpc("cms_save_settings", {
      p_settings: {
        ...originalSettings.data,
        currency: "AUD",
        holdsEnabled: true,
      },
      p_expected: originalSettings.updated_at,
    }),
  );
  async function submit(suffix, price = 2345, key = crypto.randomUUID()) {
    const response = await fetch("http://localhost:3102/api/holds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3102",
      },
      body: JSON.stringify({
        name: "CMS verification",
        email: `cms-test-${suffix}@example.invalid`,
        note: "Disposable verification fixture",
        cardIds: [id],
        prices: { [id]: price },
        requestKey: key,
        website: "",
      }),
    });
    return { response, body: await response.json(), key };
  }
  const wrongPrice = await submit("wrong", 1);
  assert.equal(wrongPrice.response.status, 409);
  assert.match(wrongPrice.body.error, /price changed/);
  const first = await submit("first");
  assert.equal(first.response.status, 201, JSON.stringify(first.body));
  requestIds.push(first.body.reference);
  const retry = await submit("first", 2345, first.key);
  assert.equal(retry.body.reference, first.body.reference);
  const second = await submit("second");
  assert.equal(second.response.status, 201);
  requestIds.push(second.body.reference);
  await check(
    await admin.rpc("cms_transition_hold", {
      p_id: first.body.reference,
      p_status: "accepted",
    }),
  );
  const collision = await admin.rpc("cms_transition_hold", {
    p_id: second.body.reference,
    p_status: "accepted",
  });
  assert.ok(collision.error);
  assert.match(collision.error.message, /no longer available/);
  await check(
    await admin.rpc("cms_transition_hold", {
      p_id: first.body.reference,
      p_status: "cancelled",
    }),
  );
  await check(
    await admin.rpc("cms_transition_hold", {
      p_id: second.body.reference,
      p_status: "accepted",
    }),
  );
  await check(
    await admin.rpc("cms_transition_hold", {
      p_id: second.body.reference,
      p_status: "completed",
    }),
  );
  const sold = await check(
    await anon.from("cards").select("availability").eq("id", id).single(),
  );
  assert.equal(sold.availability, "sold");
  const direct = await fetch("http://localhost:3102/api/holds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unrelated.example",
    },
    body: "{}",
  });
  assert.equal(direct.status, 403);
  console.log(
    "Live checks passed: draft privacy, unauthorized writes, publish and price update, stale edits, storefront connection, private requests, server-authoritative pricing, idempotency, reservation collision, cancellation, sale completion, cross-origin protection.",
  );
} finally {
  await check(
    await service
      .from("store_settings")
      .update({
        data: originalSettings.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true),
  );
  // Only known records created by this verification run are removed.
  await check(
    await service.from("cards").update({ reserved_by: null }).eq("id", id),
  );
  if (requestIds.length) {
    await check(
      await service
        .from("hold_request_items")
        .delete()
        .in("request_id", requestIds),
    );
    await check(
      await service.from("hold_requests").delete().in("id", requestIds),
    );
  }
  await check(await service.from("cards").delete().eq("id", id));
  await admin.auth.signOut();
}
