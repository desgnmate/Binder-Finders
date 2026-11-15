import "server-only";

/**
 * Stable application origin for Stripe Checkout URLs.
 *
 * Unlike the SEO siteUrl() helper, this may use a Vercel deployment URL
 * because payment retries/reconciliation must reproduce exactly the same
 * Checkout create parameters in the API route and scheduled worker.
 */
export function paymentSiteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (configured) return configured;

  const vercel = (process.env.VERCEL_URL || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

  if (vercel) return `https://${vercel}`;

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  throw new Error("Payment site URL is not configured");
}
