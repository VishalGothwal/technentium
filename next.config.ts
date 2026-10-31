import type { NextConfig } from "next";

/** Baseline security headers (PRD §13.1). A strict CSP is a follow-up once third-party scripts are known. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Lets client components show "Continue with Google" only when the server has Google OAuth credentials.
  env: { NEXT_PUBLIC_GOOGLE_SIGN_IN: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "1" : "" },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The local single-connection dev database (DATABASE_POOL_MAX=1) can't serve parallel prerender
  // workers; build serially there. Hosted Postgres builds keep Next's defaults.
  experimental:
    process.env.DATABASE_POOL_MAX === "1"
      ? { cpus: 1, staticGenerationMaxConcurrency: 1, staticGenerationRetryCount: 3 }
      : { staticGenerationRetryCount: 1 },
  // Native / Node-only packages stay external to the server bundle.
  serverExternalPackages: ["sharp", "@prisma/adapter-pg", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
