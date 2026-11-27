import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { testHooksEnabled } from "@/server/test-hooks";

/**
 * Fixed-window limiter on the shared `rate_limits` table (same table Better Auth uses, prefixed
 * keys keep them apart). Database-backed so limits hold across serverless instances.
 * Returns false when the limit is exceeded.
 */
export async function hit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  if (testHooksEnabled()) return true;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const fullKey = `app:${key}`;

  // One atomic statement: parallel requests can't all read the same count and slip past the limit.
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limits" ("id", "key", "count", "lastRequest")
    VALUES (gen_random_uuid()::text, ${fullKey}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limits"."lastRequest" < ${BigInt(windowStart)} THEN 1 ELSE "rate_limits"."count" + 1 END,
      "lastRequest" = CASE WHEN "rate_limits"."lastRequest" < ${BigInt(windowStart)} THEN ${BigInt(now)} ELSE "rate_limits"."lastRequest" END
    RETURNING "count"`;
  return row.count <= max;
}

export async function enforce(key: string, windowSeconds: number, max: number) {
  if (!(await hit(key, windowSeconds, max))) {
    throw new AppError("RATE_LIMITED", "errors.rateLimited");
  }
}
