import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/server/auth/session";
import { isAppError } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { createT } from "@/i18n/translate";
import { isLocale } from "@/i18n/config";

type Handler<C> = (req: NextRequest, ctx: C, actor: Actor | null) => Promise<Response | unknown>;

/**
 * `/api/v1` route wrapper (PRD §11.7): resolves the actor, serialises results as JSON and maps
 * domain errors to `{ error: { code, message, fields } }` with the right HTTP status.
 * Messages are localised from `Accept-Language` (en/hi).
 */
export function api<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const actor = await getActor();
      const result = await handler(req, ctx, actor);
      if (result instanceof Response) return result;
      return NextResponse.json({ data: result ?? null }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const lang = req.headers.get("accept-language")?.slice(0, 2);
      const t = createT(isLocale(lang) ? lang : "en");
      if (isAppError(err)) {
        const fields = (err.details as { fields?: Record<string, string> } | undefined)?.fields;
        return NextResponse.json(
          {
            error: {
              code: err.code,
              messageKey: err.messageKey,
              message: t(err.messageKey),
              fields: fields ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, t(v)])) : undefined,
            },
          },
          { status: err.status },
        );
      }
      console.error("[api] unexpected error", err);
      return NextResponse.json({ error: { code: "INTERNAL", messageKey: "errors.generic", message: t("errors.generic") } }, { status: 500 });
    }
  };
}

export async function jsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
