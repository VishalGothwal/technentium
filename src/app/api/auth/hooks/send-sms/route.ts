import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { appPhone } from "@/server/auth/provision";
import { db } from "@/server/db";
import { getFeatures } from "@/server/features";
import { smsAdapter, testOtpHooks } from "@/server/providers/sms";

/**
 * Supabase Auth "Send SMS" hook (Dashboard → Authentication → Hooks → Send SMS → HTTPS,
 * URL `<APP_URL>/api/auth/hooks/send-sms`, secret in SUPABASE_SMS_HOOK_SECRET). Supabase generates and checks
 * the code; this delivers it through our SMS provider (Fast2SMS), or — in test mode — records it for
 * Admin → Feature controls instead of sending a real SMS.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!verifySignature(req, body)) return hookError(401, "Invalid signature");

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError(400, "Invalid payload");
  }
  const phone = appPhone(payload.user?.phone);
  const otp = payload.sms?.otp;
  if (!phone || !otp) return hookError(400, "Only Indian mobile numbers are supported");

  const features = await getFeatures();
  if (!features.signIn.phoneOtp) return hookError(403, "Mobile number sign-in is switched off");

  testOtpHooks.record(phone, otp);
  if (features.testMode) {
    await db.testOtp.create({ data: { phone, code: otp } });
    await db.testOtp.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
    });
    console.info(`[sms:test-mode] code for ${phone} captured (see Admin → Feature controls)`);
    return NextResponse.json({});
  }

  try {
    await smsAdapter().sendOtp(phone, otp);
    return NextResponse.json({});
  } catch (e) {
    console.error("[sms] OTP delivery failed", e);
    return hookError(502, "SMS delivery failed");
  }
}

/** Supabase hooks expect `{ error: { http_code, message } }` on failure. */
const hookError = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

/** Standard Webhooks signature: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), within 5 minutes. */
function verifySignature(req: NextRequest, body: string) {
  const secret = process.env.SUPABASE_SMS_HOOK_SECRET;
  if (!secret) return false;
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatures = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64"));
  return signatures.split(" ").some((s) => {
    const given = Buffer.from(s.split(",")[1] ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
