import "server-only";
import { testHooksEnabled } from "@/server/test-hooks";

/**
 * SMS provider adapter. Only a console stub exists until a provider is selected (PRD §17, D-11/D-20).
 * A real adapter (e.g. MSG91, Twilio) implements the same interface and is chosen by SMS_DRIVER.
 */
export interface SmsAdapter {
  readonly name: string;
  send(to: string, body: string): Promise<{ providerMessageId: string | null }>;
}

const consoleSms: SmsAdapter = {
  name: "console",
  async send(to, body) {
    console.info(`[sms:console] to=${to} body=${JSON.stringify(body)}`);
    return { providerMessageId: null };
  },
};

export function smsAdapter(): SmsAdapter {
  return consoleSms;
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
