import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { auth } from "@/server/auth/auth";
import type { Actor } from "@/server/rbac/actor";
import { PERMISSIONS, ROLE_KEYS, type Permission, type RoleKey } from "@/server/rbac/permissions";

const isPermission = (k: string): k is Permission => (PERMISSIONS as readonly string[]).includes(k);
const isRoleKey = (k: string): k is RoleKey => (ROLE_KEYS as readonly string[]).includes(k);

/** Build an Actor for a user id. Permissions come from the database so role edits apply immediately. */
export async function loadActor(userId: string, meta?: { ipAddress?: string | null; userAgent?: string | null }): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      staffProfile: { select: { active: true } },
      roles: { select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
    },
  });
  if (!user) return null;

  const staffActive = user.staffProfile?.active ?? false;
  // A deactivated staff member keeps only customer capabilities.
  const roles = staffActive ? user.roles.map((r) => r.role.key).filter(isRoleKey) : [];
  const permissions = new Set<Permission>();
  if (staffActive) {
    for (const r of user.roles) for (const p of r.role.permissions) if (isPermission(p.permission.key)) permissions.add(p.permission.key);
  }

  return {
    userId: user.id,
    name: user.name,
    roles,
    permissions,
    isStaff: staffActive && roles.length > 0,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  };
}

/** Current request's session (Better Auth), memoised per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Current request's Actor, or null for guests. Memoised per request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  return loadActor(session.user.id, {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
});
