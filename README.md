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

Mobile apps authenticate with a bearer token (`set-auth-token` header from the Better Auth sign-in endpoints) and use the same
`/api/v1` routes. The OpenAPI 3.1 document is at `/api/v1/openapi.json`, rendered for humans at `/en/developers`.
SEO: per-page canonical and hreflang metadata, JSON-LD, `/sitemap.xml` and `/robots.txt`. Analytics (GA4) loads only after the visitor
opts in, and only when `NEXT_PUBLIC_GA_ID` is set.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma 7 · Better Auth
(mobile OTP, email/password, TOTP 2FA for owners) · Vitest · Playwright. Designed for Vercel.

## Local setup

```bash
npm install
cp .env.example .env            # fill BETTER_AUTH_SECRET, CRON_SECRET
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

In development, OTP codes, emails and SMS/WhatsApp messages are printed to the server console.

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

1. Create a Postgres database (Neon, Supabase, Vercel Postgres…) and an S3-compatible bucket (e.g. Cloudflare R2).
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
