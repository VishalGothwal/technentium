import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/server/env";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<{ providerMessageId: string | null }>;
}

const consoleEmail: EmailAdapter = {
  name: "console",
  async send(m) {
    console.info(`[email:console] to=${m.to} subject=${JSON.stringify(m.subject)}\n${m.text}`);
    return { providerMessageId: null };
  },
};

let smtp: EmailAdapter | undefined;

export function emailAdapter(): EmailAdapter {
  const e = env();
  if (e.NOTIFY_EMAIL_DRIVER !== "smtp") return consoleEmail;
  if (!smtp) {
    if (!e.SMTP_URL) throw new Error("SMTP_URL is required when NOTIFY_EMAIL_DRIVER=smtp");
    const transport = nodemailer.createTransport(e.SMTP_URL);
    smtp = {
      name: "smtp",
      async send(m) {
        const info = await transport.sendMail({ from: e.EMAIL_FROM, ...m });
        return { providerMessageId: info.messageId ?? null };
      },
    };
  }
  return smtp;
}

/** Phone-only sign-ups get a placeholder address; never email it. */
export const PLACEHOLDER_EMAIL_DOMAIN = "phone.technentium.invalid";
export const isDeliverableEmail = (email: string | null | undefined): email is string =>
  !!email && !email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
