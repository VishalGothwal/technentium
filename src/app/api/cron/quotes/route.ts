import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/server/http";
import { processQuoteExpiry } from "@/server/modules/quotes/quote.service";

/** Vercel Cron: quote reminders and expiry (D-07). */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await processQuoteExpiry();
  return NextResponse.json({ reminded: result.reminded, expired: result.expired });
}
