import "server-only";
import type { Tx } from "@/server/db";
import type { Actor } from "@/server/rbac/actor";

type AuditInput = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

const toJson = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Record an audit entry inside the caller's transaction so it commits or rolls back with the change. */
export async function audit(tx: Tx, actor: Actor | null, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      actorId: actor?.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: toJson(input.before),
      after: toJson(input.after),
      ipAddress: actor?.ipAddress ?? null,
    },
  });
}
