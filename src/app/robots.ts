import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

/** Crawl rules: public marketing/content pages only; never the admin, APIs, accounts or auth flows. */
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";
  if (!isProduction) {
    // Preview / development deployments must never be indexed.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/*/account", "/*/auth/", "/*/protection/cart", "/*/protection/checkout", "/*/preview"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
