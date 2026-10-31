import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_URL: z.url(),
  CRON_SECRET: z.string().min(16),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  NOTIFY_EMAIL_DRIVER: z.enum(["console", "smtp"]).default("console"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Technentium <no-reply@example.com>"),
  SMS_DRIVER: z.enum(["console", "fast2sms"]).default("console"),
  FAST2SMS_API_KEY: z.string().optional(),
  /** "otp" (Fast2SMS ready OTP route, no DLT registration) or "dlt" (your registered sender + template). */
  FAST2SMS_ROUTE: z.enum(["otp", "dlt"]).default("otp"),
  FAST2SMS_SENDER_ID: z.string().optional(),
  FAST2SMS_TEMPLATE_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Throws on first access if misconfigured. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
