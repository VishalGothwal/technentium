import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { getFeatures } from "@/server/features";
import type { Actor } from "@/server/rbac/actor";
import { PERMISSIONS, ROLE_KEYS, type Permission, type RoleKey } from "@/server/rbac/permissions";
import { createSupabaseServerClient, createSupabaseStatelessClient, supabaseConfigured } from "@/server/supabase/server";
import { isDeliverableEmail } from "@/server/providers/email";
import { readViewAsCookie } from "./impersonation";
import { appUserIdFor } from "./provision";

const isPermission = (k: string): k is Permission => (PERMISSIONS as readonly string[]).includes(k);
const isRoleKey = (k: string): k is RoleKey => (ROLE_KEYS as readonly string[]).includes(k);

/** Build an Actor for a user id. Permissions come from the database so role edits apply immediately. Blocked users get null. */
export async function loadActor(userId: string, meta?: { ipAddress?: string | null; userAgent?: string | null }): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      blockedAt: true,
      staffProfile: { select: { active: true } },
      roles: {
        select: {
          role: {
            select: {
              key: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!user || user.blockedAt) return null;

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
    email: isDeliverableEmail(user.email) ? user.email : null,
    phoneNumber: user.phoneNumber,
    roles,
    permissions,
    isStaff: staffActive && roles.length > 0,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  };
}

/** A JWT has three dot-separated parts; anything else (e.g. the cron secret) is not a Supabase token. */
const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * The verified Supabase identity for this request: the browser's auth cookies, or a mobile app's
 * `Authorization: Bearer <access_token>`. Memoised per request.
 */
export const getAuthIdentity = cache(async () => {
  if (!supabaseConfigured()) return null;
  const h = await headers();
  const bearer = h.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const token = bearer && JWT_SHAPE.test(bearer) ? bearer : undefined;
  const supabase = token ? createSupabaseStatelessClient() : await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  return {
    authUserId: claims.sub,
    aal: (claims.aal as string | undefined) ?? "aal1",
    issuedAt: typeof claims.iat === "number" ? claims.iat * 1000 : 0,
    viaBearer: !!token,
    /** Full user from the Auth server (network call) — only needed when linking a first sign-in. */
    fetchUser: async () => (await supabase.auth.getUser(token)).data.user,
  };
});

/** The signed-in person's own Actor (never the "view as" target). Memoised per request. */
export const getRealActor = cache(async (): Promise<Actor | null> => {
  const identity = await getAuthIdentity();
  if (!identity) return null;
  const userId = await appUserIdFor(identity.authUserId, identity.fetchUser);
  if (!userId) return null;
  const h = await headers();
  const actor = await loadActor(userId, {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
  if (!actor) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, sessionsRevokedAt: true },
  });
  // "Sign out everywhere": tokens issued before the revocation stop working at once, not when they expire.
  if (user?.sessionsRevokedAt && identity.issuedAt < user.sessionsRevokedAt.getTime()) return null;
  // Staff with two-factor on must finish the authenticator step before any staff permission applies.
  if (!actor.isStaff || identity.aal === "aal2" || !user?.twoFactorEnabled) return actor;
  return {
    ...actor,
    roles: [],
    permissions: new Set(),
    isStaff: false,
    needsSecondFactor: true,
  };
});

/**
 * Current request's Actor, or null for guests. When an admin has switched into another account
 * ("view as"), this is that account, with `impersonator` set. Memoised per request.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const real = await getRealActor();
  if (!real) return null;
  const identity = await getAuthIdentity();
  if (identity?.viaBearer) return real;

  const viewAs = await readViewAsCookie();
  if (!viewAs || viewAs.byUserId !== real.userId || viewAs.targetUserId === real.userId) return real;
  if (!real.permissions.has("user.impersonate") || !(await getFeatures()).impersonation) return real;

  const target = await loadActor(viewAs.targetUserId, {
    ipAddress: real.ipAddress,
    userAgent: real.userAgent,
  });
  // Owners can't be impersonated: it would hand their full access to whoever holds the switch.
  if (!target || target.roles.includes("owner")) return real;
  return { ...target, impersonator: { userId: real.userId, name: real.name } };
});

/** `{ user }` for the signed-in person (or the "view as" target), shaped like the old session object. */
export const getSession = cache(async () => {
  const actor = await getActor();
  if (!actor) return null;
  return {
    user: {
      id: actor.userId,
      name: actor.name,
      email: actor.email ?? null,
      phoneNumber: actor.phoneNumber ?? null,
    },
  };
});
