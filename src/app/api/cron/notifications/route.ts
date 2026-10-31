import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/server/http";
import { sweepDeliveries } from "@/server/notifications/dispatch";

/** Vercel Cron: retry due notification deliveries (see vercel.json). */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const processed = await sweepDeliveries(200);
  return NextResponse.json({ processed });
}
