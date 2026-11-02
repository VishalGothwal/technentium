# Technentium

Mobile-first website and admin platform for device repairs in Jaipur (PRD v0.1, provisional).
Sections (customer site in English and Hindi, under `/en` and `/hi`):

| Section | Customer | Admin | API |
|---|---|---|---|
| Repairs | `/repairs`, booking wizard, quote approval, tracking | booking queue, jobs table and board, quotes, returns | `/api/v1/repair/*` |
| Protection (store) | `/protection` catalogue, device fit, cart, order request | `/admin/orders`, `/admin/products` (stock, compatibility) | `/api/v1/products`, `/cart`, `/product-requests` |
| Customization | `/customize` studio with live preview and artwork upload | `/admin/customization`, `/admin/designs` | `/api/v1/designs`, `/customization/requests` |
| Content | `/articles`, `/videos`, `/specs`, `/compare` | `/admin/content`, `/admin/specs` | `/api/v1/content/*` |
| Account & tracking | `/account`, `/track` (repairs, orders and designs) | dashboard, audit, notifications | `/api/v1/account/*`, `/api/v1/track/{ref}` |

Mobile apps sign in with the Supabase SDK and send its access token as `Authorization: Bearer <token>` to the same
`/api/v1` routes (`GET /api/v1/app/config` gives them the Supabase URL and publishable key). The OpenAPI 3.1 document is at `/api/v1/openapi.json`, rendered for humans at `/en/developers`.
SEO: per-page canonical and hreflang metadata, JSON-LD, `/sitemap.xml` and `/robots.txt`. Analytics (GA4) loads only after the visitor
opts in, and only when `NEXT_PUBLIC_GA_ID` is set.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth: mobile OTP via
Fast2SMS, Google, email/password, TOTP 2FA for owners) · Prisma 7 · Vitest · Playwright. Designed for Vercel.

## Local setup

```bash
npm install
cp .env.example .env            # fill the Supabase keys (see "Supabase setup") and CRON_SECRET
npm run db:dev                  # local Postgres via `prisma dev` (or point DATABASE_URL at any Postgres)
npm run db:migrate              # apply migrations
npm run db:seed                 # roles, catalogue, Jaipur pincodes, slots, demo users
npm run dev                     # http://localhost:3000  (admin: /admin)
```

With `npx prisma dev` (PGlite) set `DATABASE_POOL_MAX="1"` and `SHADOW_DATABASE_URL` to its shadow port; the dev
server ignores database names, so it cannot create a shadow database itself.

Demo accounts (non-production seed only, password `Technentium#2026` or `SEED_DEMO_PASSWORD`):
`owner@`, `staff@`, `tech@`, `tech2@`, `editor@`, `inventory@`, `customer@technentium.test`.

If the local database stops accepting connections ("Connection terminated unexpectedly" everywhere), restart it with
`npx prisma dev stop technentium` then `npm run db:dev`. If start reports "Lock file is already being held" and no daemon is running,
delete `%LOCALAPPDATA%prisma-dev-nodejsDatadurable-streams	echnentiumserver.lock.lock` and start again.

In development, emails and SMS/WhatsApp notifications are printed to the server console. Sign-in codes come from
Supabase: turn on **Test mode** in Admin → Feature controls to read them there instead of receiving an SMS.

## Supabase setup

Sign-in runs on Supabase Auth; app data stays in Prisma tables (`users.authUserId` links each account to its Supabase
user, set automatically on first sign-in — existing accounts are matched by verified email or phone).

1. **Keys** (Project Settings → API Keys): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the
   server-only `SUPABASE_SECRET_KEY` (staff invites, Users & access, switch user, demo logins in the seed).
2. **Database** (Connect → ORMs → Prisma): app `DATABASE_URL` = transaction pooler (6543, `?pgbouncer=true`); run
   `prisma migrate deploy` with the session/direct URL (5432). The `lock_public_schema` migration turns on RLS and revokes
   Data API access to app tables — the app only reaches them through Prisma on the server.
3. **URL configuration** (Authentication → URL Configuration): Site URL = `APP_URL`; add
   `<APP_URL>/api/auth/callback` (and `http://localhost:3000/api/auth/callback`) to Redirect URLs.
4. **Email templates** (Authentication → Emails) — required: point each link at the callback,
   `{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=<type>`, with `type` = `signup` (Confirm signup),
   `invite` (Invite user), `recovery` (Reset password), `email_change` (Change email address). Staff invitations and
   admin-sent reset links don't work with the default templates (their token would only reach the browser).
   Reset and invite links land on the set-password page; the others on the account page.
5. **Phone sign-in**: enable the Phone provider, then Authentication → Hooks → **Send SMS** → HTTPS
   `<APP_URL>/api/auth/hooks/send-sms`; copy its secret to `SUPABASE_SMS_HOOK_SECRET`. Codes go out through Fast2SMS
   (`SMS_DRIVER=fast2sms`), or are captured on the Feature controls page in test mode.
6. **Google**: enable it under Authentication → Providers with your Google OAuth client; the Google redirect URI is the one
   Supabase shows there (`https://<ref>.supabase.co/auth/v1/callback`).
7. **Two-factor**: Authentication → Multi-Factor → TOTP enabled (default). Owners enrol again after the move (secrets
   from the previous auth system can't be carried over).
8. `npm run db:seed` with `SUPABASE_SECRET_KEY` set creates Supabase logins for the demo staff accounts.

**Admin controls** (Owner): *Feature controls* (`/admin/controls`) switches sign-in methods, new sign-ups, site
sections, test mode, maintenance mode and switch user, and checks the setup above. *Users & access* (`/admin/users`)
edits any profile, blocks accounts, sends reset links or sets passwords, signs people out everywhere, resets two-factor and
**switches into** any non-owner account (also from Team & roles) — every action is audited, including what was done
while switched in. Every staff member has *My profile* (`/admin/profile`).

## Tests

```bash
npm test                    # unit: money, state machine, fee rules
npm run test:integration    # services against a separate DB configured in .env.test
npm run test:e2e            # Playwright (mobile + desktop) against the running dev server
```

## Architecture

```
src/
  app/[locale]/…           customer site (en, hi) — locale from next/root-params
  app/admin/…              staff console (English)
  app/api/v1/…             JSON API (PRD §11); app/api/cron/… Vercel Cron jobs
  server/modules/…         business logic — the only place rules live
    repairs/state-machine.ts   declarative lifecycle table (pure, unit-tested)
    repairs/transition.ts      the single place a job status changes
    quotes/money.ts            integer-paise arithmetic
  server/rbac/permissions.ts   role → permission baseline (PRD §8)
  server/notifications/…       transactional outbox, channel matrix, adapters
```

- **Authorisation** is enforced in services (`assertCan`), never only in the UI. Records a customer may not see
  return 404.
- **Status changes** go through `applyJobTransition`: rule + actor + guard checks, compare-and-set update, history,
  audit and notification outbox in one transaction.
- **Notifications** are written to an outbox in the business transaction, delivered after commit (`after()`), and
  retried by `/api/cron/notifications`. A provider failure never undoes a booking.
- **Money** is stored in integer paise; totals are computed only on the server.
- **Files** are re-encoded (EXIF stripped), stored privately, and served through an authorising route.

## Deployment (Vercel)

1. Create the Supabase project (see "Supabase setup") and an S3-compatible bucket (e.g. Cloudflare R2).
2. Set the variables from `.env.example` in the Vercel project (`STORAGE_DRIVER=s3`, `NOTIFY_EMAIL_DRIVER=smtp`).
3. Run `npm run db:deploy` against production, then seed reference data (`NODE_ENV=production npm run db:seed` — no demo users).
4. `vercel.json` schedules the cron routes. Vercel Hobby only allows daily crons; the 10-minute notification retry
   needs a Pro plan (or an external scheduler calling the route with `Authorization: Bearer $CRON_SECRET`).

## Provisional decisions (PRD §20)

Implemented with the PRD's proposed defaults, all configurable in Admin → Settings: no payment recording (D-04/05),
owner-configured diagnosis fees (D-06), 7-day quote expiry with reminder (D-07), return charges disclosed before
decline (D-08), sample Jaipur pincodes/slots (D-09), §8 role matrix (D-10), in-app + email for all events with
SMS/WhatsApp stubs (D-11), English fallback for missing Hindi (D-12), placeholder warranty terms (D-16), neutral brand
tokens in `globals.css` (D-18). Policy pages and Hindi copy are drafts pending review.
