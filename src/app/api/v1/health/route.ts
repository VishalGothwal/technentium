import { NextResponse } from "next/server";
import { db } from "@/server/db";

/** GET /api/v1/health — liveness + database check for uptime monitors and app start-up. */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ data: { status: "ok", db: "ok", latencyMs: Date.now() - started } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ data: { status: "degraded", db: "unreachable" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
