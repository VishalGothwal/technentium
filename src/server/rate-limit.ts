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

  return db.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key: fullKey } });
    if (!row || Number(row.lastRequest) < windowStart) {
      await tx.rateLimit.upsert({
        where: { key: fullKey },
        create: { key: fullKey, count: 1, lastRequest: BigInt(now) },
        update: { count: 1, lastRequest: BigInt(now) },
      });
      return true;
    }
    if (row.count >= max) return false;
    await tx.rateLimit.update({ where: { key: fullKey }, data: { count: { increment: 1 } } });
    return true;
  });
}

export async function enforce(key: string, windowSeconds: number, max: number) {
  if (!(await hit(key, windowSeconds, max))) {
    throw new AppError("RATE_LIMITED", "errors.rateLimited");
  }
}
