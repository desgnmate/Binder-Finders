import { z } from "zod";

export const CONTACT_TOPICS = [
  { value: "card", label: "A card I saw" },
  { value: "order", label: "My order or hold" },
  { value: "wishlist", label: "Wishlist request" },
  { value: "selling", label: "Selling to you" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export const contactSchema = z.object({
  topic: z.enum(["card", "order", "wishlist", "selling"]),
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  reference: z.string().trim().max(200).default(""),
  message: z.string().trim().min(10, "Write a little more so we can help").max(4000),
  // Honeypot: people never see this field, so anything in it is a bot.
  website: z.string().max(200).default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ContactInput, string>> };

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** The email the store receives for a contact form message. */
export function contactEmail(input: ContactInput) {
  const topic = CONTACT_TOPICS.find((t) => t.value === input.topic)!.label;
  const rows: [string, string][] = [
    ["Topic", topic],
    ["Name", input.name],
    ["Email", input.email],
    ...(input.reference ? ([["Card or request", input.reference]] as [string, string][]) : []),
  ];
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${input.message}\n\nReply to this email to answer ${input.name}.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">
<h2 style="margin:0 0 12px">New message from the website</h2>
<table cellpadding="4" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="font-weight:bold;padding-right:12px">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("")}</table>
<p style="white-space:pre-wrap;border-top:2px solid #1a1a1a;margin-top:16px;padding-top:16px">${escapeHtml(input.message)}</p>
<p style="color:#555">Reply to this email to answer ${escapeHtml(input.name)}.</p>
</div>`;
  return { subject: `Website message: ${topic} — ${input.name}`.slice(0, 200), text, html };
}
