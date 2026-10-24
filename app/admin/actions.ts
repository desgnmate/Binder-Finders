"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin, serviceClient } from "../../lib/supabase/server";
import {
  cardSchema,
  collectionSchema,
  settingsSchema,
} from "../../lib/cms/types";
import { z } from "zod";
function refresh() {
  revalidateTag("store-catalog");
  revalidatePath("/admin");
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The change could not be saved. Please try again.";
}
export async function saveCard(input: unknown) {
  try {
    const { db } = await requireAdmin();
    const card = cardSchema.parse(input);
    const { error } = await db.rpc("cms_save_card", {
      p_card: card,
      p_expected: card.updatedAt ?? null,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function saveCollection(input: unknown) {
  try {
    const { db } = await requireAdmin();
    const collection = collectionSchema.parse(input);
    if (new Set(collection.cardIds).size !== collection.cardIds.length)
      throw new Error("Each card can appear only once per collection");
    const { error } = await db.rpc("cms_save_collection", {
      p_collection: collection,
      p_expected: collection.updatedAt ?? null,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function saveSettings(input: unknown, expected: string) {
  try {
    const { db } = await requireAdmin();
    const settings = settingsSchema.parse(input);
    const { error } = await db.rpc("cms_save_settings", {
      p_settings: settings,
      p_expected: expected,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function transitionHold(id: string, status: string) {
  // Retained for older clients, with the same validation as the current editor.
  return updateHoldWorkflow(id, { status });
}
export async function updateHoldWorkflow(id: string, input: unknown) {
  try {
    const { db } = await requireAdmin();
    const values = z
      .object({
        status: z
          .enum(["accepted", "rejected", "cancelled", "completed"])
          .optional(),
        paymentStatus: z
          .enum(["unpaid", "pending", "paid", "failed", "refunded"])
          .optional(),
        fulfillmentStatus: z
          .enum([
            "not_ready",
            "ready",
            "shipped",
            "delivered",
            "picked_up",
            "cancelled",
          ])
          .optional(),
        paymentReference: z.string().trim().max(200).optional(),
        fulfillmentNote: z.string().trim().max(1000).optional(),
        expiresAt: z.string().trim().optional(),
      })
      .parse(input);
    z.string().uuid().parse(id);
    const { error } = await db.rpc("cms_set_hold_workflow", {
      p_id: id,
      p_status: values.status ?? null,
      p_payment_status: values.paymentStatus ?? null,
      p_fulfillment_status: values.fulfillmentStatus ?? null,
      p_payment_reference: values.paymentReference ?? null,
      p_fulfillment_note: values.fulfillmentNote ?? null,
    });
    if (error) throw new Error(error.message);
    if (values.expiresAt) {
      const expiresAt = new Date(values.expiresAt);
      if (!Number.isFinite(expiresAt.getTime())) throw new Error("Choose a valid hold deadline");
      const { error: deadlineError } = await db.rpc("cms_set_hold_deadline", {
        p_id: id,
        p_expires_at: expiresAt.toISOString(),
      });
      if (deadlineError) throw new Error(deadlineError.message);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function uploadImage(form: FormData) {
  try {
    const { db, user } = await requireAdmin();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 8 * 1024 * 1024
    )
      throw new Error("Choose an image up to 8 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (b, i) => bytes[i] === b,
    );
    const webp =
      String.fromCharCode(...Array.from(bytes.slice(0, 4))) === "RIFF" &&
      String.fromCharCode(...Array.from(bytes.slice(8, 12))) === "WEBP";
    const ext = jpeg ? "jpg" : png ? "png" : webp ? "webp" : null;
    if (!ext) throw new Error("Use a JPEG, PNG or WebP image");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from("card-scans")
      .upload(path, bytes, {
        contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp",
        upsert: false,
      });
    if (error) throw new Error("Image upload failed. Please try again.");
    return { ok: true, url: `/api/scans/${path}` };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function setAdmin(input: unknown) {
  try {
    const { db } = await requireAdmin(true);
    const member = z
      .object({
        userId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["owner", "editor"]),
        active: z.boolean(),
      })
      .parse(input);
    const { error } = await db.rpc("cms_set_admin", {
      p_user: member.userId,
      p_email: member.email,
      p_role: member.role,
      p_active: member.active,
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function inviteAdmin(email: string) {
  try {
    const { db } = await requireAdmin(true);
    z.string().email().max(200).parse(email);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || (await headers()).get("origin");
    if (!origin) throw new Error("Store URL is not configured");
    const { data, error } = await serviceClient().auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${origin}/admin/reset-password` },
    );
    if (error || !data.user)
      throw new Error(
        "Invitation could not be sent. Check the email or use an existing user ID.",
      );
    const { error: roleError } = await db.rpc("cms_set_admin", {
      p_user: data.user.id,
      p_email: email,
      p_role: "editor",
      p_active: true,
    });
    if (roleError)
      throw new Error(
        "Account created but access was not granted. Add its user ID under administrator access.",
      );
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
