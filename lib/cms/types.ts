import { z } from "zod";
import type { ShopCard } from "../data";

const imageUrl = z
  .string()
  .max(2048)
  .refine(
    (v) => !v || /^https:\/\//.test(v) || /^\/(?!\/)/.test(v),
    "Use an HTTPS image URL or a local image path",
  );
export const cardSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
    name: z.string().trim().min(1).max(120),
    pokemonId: z.number().int().min(1).max(1025),
    set: z.string().trim().min(1).max(120),
    year: z.number().int().min(1996).max(2100),
    number: z.string().trim().min(1).max(40),
    rarity: z.enum([
      "Common",
      "Uncommon",
      "Rare",
      "Rare Holo",
      "Ultra Rare",
      "Secret Rare",
      "Shining Holo",
    ]),
    condition: z.enum(["RAW NM", "RAW LP", "PSA 8", "PSA 9", "PSA 10"]),
    type: z.enum([
      "Fire",
      "Water",
      "Grass",
      "Lightning",
      "Psychic",
      "Metal",
      "Colorless",
      "Dark",
      "Dragon",
      "Fighting",
      "Ground",
      "Flying",
      "Ice",
      "Bug",
      "Rock",
      "Ghost",
      "Poison",
      "Normal",
      "Steel",
      "Fairy",
    ]),
    price: z
      .number()
      .finite()
      .min(0)
      .max(10000000)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
        "Use at most two decimal places",
      ),
    imageUrl,
    backImageUrl: imageUrl.optional().default(""),
    additionalImages: z.array(imageUrl).max(10).default([]),
    description: z.string().max(3000),
    publication: z.enum(["draft", "published", "archived"]),
    availability: z.enum(["available", "reserved", "sold", "unavailable"]),
    featuredOrder: z.number().int().min(0).max(9999).nullable().default(null),
    updatedAt: z.string().nullable().optional(),
  })
  .refine((v) => v.publication !== "published" || Boolean(v.imageUrl), {
    message: "A front image is required before publishing",
    path: ["imageUrl"],
  });
export type CMSCard = z.infer<typeof cardSchema>;
export type AdminCardSummary = Pick<
  CMSCard,
  "id" | "name" | "set" | "condition" | "publication"
>;
export interface AdminDashboardStats {
  available: number;
  reserved?: number;
  drafts: number;
  newRequests: number;
  sold: number;
}
export type CatalogCard = ShopCard & {
  additionalImages?: string[];
  featuredOrder?: number | null;
};
export const contentSchema = z.object({
  heroLine1: z.string().trim().min(1).max(22),
  heroLine2: z.string().trim().min(1).max(22),
  heroSubtitle: z.string().trim().min(1).max(180),
  heroCta: z.string().trim().min(1).max(24),
  aboutTitle: z.string().trim().min(1).max(90),
  aboutBody: z.string().trim().min(1).max(600),
  footerTitle: z.string().trim().min(1).max(50),
  footerDescription: z.string().trim().min(1).max(240),
  storeDescription: z.string().trim().min(1).max(600),
  contactEmail: z.string().email().max(200),
  location: z.string().trim().min(1).max(100),
});
export const defaultContent: z.infer<typeof contentSchema> = {
  heroLine1: "Home of Vintage",
  heroLine2: "Pokemon Cards",
  heroSubtitle:
    "Hand-inspected Hoenn-era collectibles.\nFlatbed scanned, certified centering.",
  heroCta: "Shop Now",
  aboutTitle: "Scans you can read.\nCards you can trust.",
  aboutBody:
    "A small collector desk for vintage Pokémon. Every card comes with a real flatbed scan – no stock photos, no mystery conditions, no surprises.",
  footerTitle: "Need a closer look?",
  footerDescription:
    "Ask for extra scans, corner photos, condition notes, holds, or a bundle quote.",
  storeDescription:
    "BinderFinders is a vintage Pokémon TCG shop specializing in Hoenn-era collectibles. Every card is hand-inspected, flatbed scanned, and graded for centering before listing.",
  contactEmail: "hello@binderfinders.com",
  location: "Melbourne, Australia",
};
export const settingsSchema = z
  .object({
    currency: z.union([
      z.literal(""),
      z.enum(["AUD", "USD", "PHP", "GBP", "EUR", "CAD", "NZD", "JPY"]),
    ]),
    holdsEnabled: z.boolean(),
    holdDurationHours: z.number().int().min(1).max(720).default(48),
    content: contentSchema,
  })
  .refine((v) => !v.holdsEnabled || v.currency !== "", {
    message: "Choose the store currency before enabling holds",
    path: ["currency"],
  });
export type StoreSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: StoreSettings = {
  currency: "",
  holdsEnabled: false,
  holdDurationHours: 48,
  content: defaultContent,
};
export interface Collection {
  id: string;
  name: string;
  sortOrder: number;
  cardIds: string[];
  updatedAt?: string;
}
export const collectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999),
  cardIds: z.array(z.string().min(1)).max(500),
  updatedAt: z.string().nullable().optional(),
});
export interface Catalog {
  cards: CatalogCard[];
  collections: Collection[];
  settings: StoreSettings;
  source: "seed" | "supabase" | "unavailable";
}
export interface Hold {
  id: string;
  customer_user_id?: string | null;
  name: string;
  email: string;
  note: string;
  status: "pending" | "accepted" | "completed" | "rejected" | "cancelled" | "expired";
  currency: string;
  payment_status?: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  payment_reference?: string | null;
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
  payment_failure_reason?: string | null;
  fulfillment_status?:
    | "not_ready"
    | "ready"
    | "shipped"
    | "delivered"
    | "picked_up"
    | "cancelled";
  fulfillment_note?: string | null;
  approved_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  hold_request_items: { card_id: string; name: string; price_cents: number }[];
  hold_status_history?: {
    id: number;
    from_status: string | null;
    to_status: string;
    actor_kind: "customer" | "admin" | "system";
    note: string | null;
    created_at: string;
  }[];
}
export interface AuditEntry {
  id: number;
  table_name: string;
  record_id: string;
  actor_id: string | null;
  created_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}
export function fromRow(row: Record<string, any>): CMSCard {
  return {
    ...row.data,
    id: row.id,
    price: row.price_cents / 100,
    publication: row.publication,
    availability: row.availability,
    featuredOrder: row.featured_order,
    updatedAt: row.updated_at,
  };
}
