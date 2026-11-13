"use server";

import { serviceClient } from "../../../lib/supabase/server";
import { contactEmail, contactSchema, type ContactInput, type ContactResult } from "../../../lib/contact";

const UNAVAILABLE = "Your message couldn't be sent right now. Please email us directly instead.";

export async function sendContactMessage(raw: Record<string, string>): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactInput;
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  // Bots fill the hidden field. Tell them it worked and send nothing.
  if (parsed.data.website) return { ok: true };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: UNAVAILABLE };

  // Messages go to the same private inbox as new hold alerts.
  let inbox: string | null = null;
  try {
    const { data } = await serviceClient()
      .from("store_private_settings")
      .select("order_alert_email")
      .eq("id", true)
      .maybeSingle();
    inbox = (data?.order_alert_email as string | null) || null;
  } catch {
    inbox = null;
  }
  if (!inbox) return { ok: false, error: UNAVAILABLE };

  const email = contactEmail(parsed.data);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [inbox], reply_to: parsed.data.email, ...email }),
    });
    if (!response.ok) return { ok: false, error: UNAVAILABLE };
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }
  return { ok: true };
}
