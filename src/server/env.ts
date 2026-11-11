import "server-only";
import { z } from "zod";

const fields = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Or POSTGRES_PRISMA_URL from the Supabase–Vercel integration (see server/db-url.ts). */
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_PRISMA_URL: z.string().min(1).optional(),
  APP_URL: z.url(),
  /** Supabase project (Dashboard → Project Settings → API). The publishable key is safe in the browser. */
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  /**
   * Server-only secret key (`sb_secret_…`, or the legacy service_role JWT). Needed for staff invitations,
   * admin user controls, switching into a user, and seeding demo accounts. Never expose it to the browser.
   */
  SUPABASE_SECRET_KEY: z.union([z.literal(""), z.string().min(20)]).optional(),
  /** Secret of the Auth "Send SMS" hook (`v1,whsec_…`), so Fast2SMS keeps delivering sign-in codes. */
  SUPABASE_SMS_HOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(16),
  STORAGE_DRIVER: z.enum(["local", "s3", "supabase"]).default("local"),
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
  /**
   * "otp": Fast2SMS OTP route ("Your OTP: 123456", no DLT); "q": Quick SMS with our own wording (no DLT, ~₹7/SMS);
   * "dlt": your registered sender ID + template (cheapest at scale).
   */
  FAST2SMS_ROUTE: z.enum(["otp", "q", "dlt"]).default("otp"),
  FAST2SMS_SENDER_ID: z.string().optional(),
  FAST2SMS_TEMPLATE_ID: z.string().optional(),
});

const schema = fields.refine((e) => !!(e.DATABASE_URL || e.POSTGRES_PRISMA_URL), { message: "Set DATABASE_URL (or POSTGRES_PRISMA_URL)", path: ["DATABASE_URL"] });

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
