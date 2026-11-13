"use server";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { sessionClient } from "../../lib/supabase/server";
import { z } from "zod";
import { closeOpenCheckouts } from "../../lib/stripe-reconciliation";
export async function saveCustomerProfile(form: FormData) {
  const name = String(form.get("name") || "").trim();
  if (!name || name.length > 120) return { error: "Enter a name of 1–120 characters." };
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email_confirmed_at) return { error: "Please sign in with a verified email." };
  const { error: insertError } = await db.from("customer_profiles").upsert({ user_id: user.id, name }, { onConflict: "user_id", ignoreDuplicates: true });
  if (insertError) return { error: "Your profile couldn't be saved. Please try again later." };
  const { error } = await db.from("customer_profiles").update({ name }).eq("user_id", user.id);
  if (error) return { error: "Your profile couldn't be saved. Please try again later." };
  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { success: true };
}
export async function customerSignOut() {
  const db = await sessionClient();
  const { error } = await db.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please try again.");
  redirect("/account/login");
}

export async function cancelCustomerHold(_previous: { error?: string; success?: boolean }, form: FormData) {
  const id = String(form.get("id") || "");
  if (!z.string().uuid().safeParse(id).success) return { error: "This request could not be found." };
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email_confirmed_at) return { error: "Please sign in with a verified email." };
  // Row security only returns the customer's own holds, so this also checks ownership
  // before any open Stripe checkout is closed on their behalf.
  const { data: own } = await db.from("hold_requests").select("id,payment_status").eq("id", id).eq("customer_user_id", user.id).maybeSingle();
  if (!own) return { error: "This request could not be found." };
  if (own.payment_status === "pending") {
    try {
      await closeOpenCheckouts(id, "customer");
    } catch (e) {
      return { error: e instanceof Error ? e.message : "This request could not be cancelled. Please refresh and try again." };
    }
  }
  const { error } = await db.rpc("cms_cancel_customer_hold", { p_id: id });
  if (error) {
    return { error: error.message.includes("can no longer") || error.message.includes("Paid") || error.message.includes("Payment is in progress")
      ? error.message
      : "This request could not be cancelled. Please refresh and try again." };
  }
  revalidateTag("store-catalog");
  revalidatePath("/account/orders");
  revalidatePath("/account");
  revalidatePath(`/account/orders/${id}`);
  return { success: true };
}
