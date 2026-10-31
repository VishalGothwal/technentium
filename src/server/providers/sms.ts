import "server-only";
import { env } from "@/server/env";
import { testHooksEnabled } from "@/server/test-hooks";

/**
 * SMS provider adapter, chosen by SMS_DRIVER: "console" (prints to the server log) or "fast2sms".
 * `sendOtp` carries sign-in codes; `send` carries free-text notifications where the provider allows it.
 */
export interface SmsAdapter {
  readonly name: string;
  /** False when the provider can only deliver OTP codes (free-text notifications are then skipped). */
  readonly supportsText: boolean;
  send(to: string, body: string): Promise<{ providerMessageId: string | null }>;
  sendOtp(to: string, code: string): Promise<{ providerMessageId: string | null }>;
}

const consoleSms: SmsAdapter = {
  name: "console",
  supportsText: true,
  async send(to, body) {
    console.info(`[sms:console] to=${to} body=${JSON.stringify(body)}`);
    return { providerMessageId: null };
  },
  async sendOtp(to, code) {
    return this.send(to, `${code} is your Technentium verification code. It expires in 5 minutes. Do not share it.`);
  },
};

/**
 * Fast2SMS (fast2sms.com). Route "otp" sends "Your OTP: 123456" without DLT registration; route "dlt"
 * uses your DLT sender ID and approved template (code passed as the template variable).
 */
function fast2sms(): SmsAdapter {
  const e = env();
  if (!e.FAST2SMS_API_KEY) throw new Error("SMS_DRIVER=fast2sms needs FAST2SMS_API_KEY");
  if (e.FAST2SMS_ROUTE === "dlt" && (!e.FAST2SMS_SENDER_ID || !e.FAST2SMS_TEMPLATE_ID)) {
    throw new Error("FAST2SMS_ROUTE=dlt needs FAST2SMS_SENDER_ID and FAST2SMS_TEMPLATE_ID");
  }
  return {
    name: "fast2sms",
    supportsText: false,
    async send() {
      throw new Error("Fast2SMS is configured for OTP codes only");
    },
    async sendOtp(to, code) {
      const body =
        e.FAST2SMS_ROUTE === "dlt"
          ? { route: "dlt", sender_id: e.FAST2SMS_SENDER_ID, message: e.FAST2SMS_TEMPLATE_ID, variables_values: code, numbers: to.replace(/^\+91/, "") }
          : { route: "otp", variables_values: code, numbers: to.replace(/^\+91/, "") };
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: { authorization: e.FAST2SMS_API_KEY!, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => null)) as { return?: boolean; request_id?: string; message?: unknown } | null;
      if (!res.ok || !data?.return) {
        // Never log the code itself.
        throw new Error(`Fast2SMS send failed (${res.status}): ${JSON.stringify(data?.message ?? null).slice(0, 200)}`);
      }
      return { providerMessageId: data.request_id ?? null };
    },
  };
}

export function smsAdapter(): SmsAdapter {
  return env().SMS_DRIVER === "fast2sms" ? fast2sms() : consoleSms;
}

/**
 * Dev/test-only capture of the last OTP per phone so Playwright can complete sign-in.
 * Never populated in production.
 */
const lastOtp = new Map<string, string>();
export const testOtpHooks = {
  enabled: testHooksEnabled,
  record(phone: string, code: string) {
    if (this.enabled()) lastOtp.set(phone, code);
  },
  read: (phone: string) => lastOtp.get(phone) ?? null,
};
