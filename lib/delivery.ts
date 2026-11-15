import { z } from "zod";

export const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

/** Where a hold's cards go. Mirrors the checks in cms_submit_hold. */
export const deliverySchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("pickup"),
    phone: z.string().trim().max(40).default(""),
  }),
  z.object({
    method: z.literal("post"),
    recipient: z.string().trim().min(1, "Enter who the parcel is for").max(120),
    phone: z.string().trim().max(40).default(""),
    line1: z.string().trim().min(1, "Enter the street address").max(200),
    line2: z.string().trim().max(200).default(""),
    suburb: z.string().trim().min(1, "Enter the suburb").max(100),
    state: z.enum(AU_STATES, { message: "Choose a state" }),
    postcode: z.string().trim().regex(/^\d{4}$/, "Enter a 4-digit postcode"),
  }),
]);

export type Delivery = z.infer<typeof deliverySchema>;
export type PostalDelivery = Extract<Delivery, { method: "post" }>;
/** As stored on a hold. Older holds have none. */
export type HoldDelivery = Delivery & { country?: string };

/** The address as printed on a parcel, one line per entry. */
export function addressLines(delivery: PostalDelivery & { country?: string }) {
  return [
    delivery.recipient,
    delivery.line1,
    delivery.line2,
    `${delivery.suburb} ${delivery.state} ${delivery.postcode}`,
    delivery.country || "Australia",
  ].filter(Boolean);
}
