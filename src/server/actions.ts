import "server-only";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { isAppError, type ErrorCode } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode | "INTERNAL"; messageKey: string; fields?: Record<string, string> };

/**
 * Wrap a Server Action body: resolve the actor, call the service, map domain errors to a
 * serialisable result, and refresh the router so server-rendered data updates.
 * Services enforce authorisation; this wrapper never trusts the client.
 */
export async function runAction<T>(fn: (actor: Actor | null) => Promise<T>, opts: { refresh?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const actor = await getActor();
    const data = await fn(actor);
    if (opts.refresh !== false) refresh();
    return { ok: true, data: (data ?? null) as T };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) {
      const fields = (err.details as { fields?: Record<string, string> } | undefined)?.fields;
      return { ok: false, code: err.code, messageKey: err.messageKey, fields };
    }
    console.error("[action] unexpected error", err);
    return { ok: false, code: "INTERNAL", messageKey: "errors.generic" };
  }
}
