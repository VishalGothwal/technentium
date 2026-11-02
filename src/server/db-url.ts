/**
 * Postgres connection strings. Locally `DATABASE_URL`; on Vercel with the Supabase integration, its pooled
 * `POSTGRES_PRISMA_URL` (app) and `POSTGRES_URL_NON_POOLING` (migrations and seeding).
 *
 * node-postgres now treats `sslmode=require` as `verify-full`, which rejects Supabase's own CA; libpq
 * semantics (encrypted, as the provider's strings intend) are kept with `uselibpqcompat=true`.
 */
function withLibpqSsl(url: string | undefined): string | undefined {
  if (!url || !/[?&]sslmode=(require|prefer)\b/.test(url) || /[?&]uselibpqcompat=/.test(url)) return url;
  return `${url}&uselibpqcompat=true`;
}

/** Pooled URL for the running app. */
export const runtimeDatabaseUrl = () => withLibpqSsl(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL);

/** Direct (session) URL for migrations and the seed. */
export const directDatabaseUrl = () => withLibpqSsl(process.env.DIRECT_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL);
