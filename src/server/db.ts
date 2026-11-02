import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { runtimeDatabaseUrl } from "./db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // `npx prisma dev` (PGlite) handles one connection at a time; set DATABASE_POOL_MAX=1 there.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString: runtimeDatabaseUrl(), max });
  return new PrismaClient({
    adapter,
    // Serverless cold starts and a small pool can delay acquiring a connection.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Transaction client type, for services that run inside db.$transaction. */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
