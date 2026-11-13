import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Preview and local builds must never be crawled or compete with the live site.
  if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or per-customer pages. "/admin" and "/account" also cover the
      // internal design-check routes that start with those names.
      disallow: ["/admin", "/account", "/checkout", "/api/", "/auth/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
