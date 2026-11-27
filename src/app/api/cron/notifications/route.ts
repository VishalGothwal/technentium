import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/server/http";
import { purgeAbandonedUploads } from "@/server/modules/media/media.service";
import { sweepDeliveries } from "@/server/notifications/dispatch";

/** Vercel Cron: retry due notification deliveries (see vercel.json), and delete abandoned customer uploads. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const processed = await sweepDeliveries(200);
  const purgedUploads = await purgeAbandonedUploads();
  return NextResponse.json({ processed, purgedUploads });
}
