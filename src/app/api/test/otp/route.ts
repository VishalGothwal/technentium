import { NextResponse, type NextRequest } from "next/server";
import { testOtpHooks } from "@/server/providers/sms";

/** E2E-only: read the last OTP sent to a phone. 404 unless E2E_TEST_HOOKS=1 outside production. */
export async function GET(req: NextRequest) {
  if (!testOtpHooks.enabled()) return new NextResponse(null, { status: 404 });
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  return NextResponse.json({ code: testOtpHooks.read(phone) });
}
