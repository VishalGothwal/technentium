import "server-only";
import { z } from "zod";
import { audit } from "@/server/audit";
import { authCallbackUrl } from "@/server/auth/flows";
import { revokeSessions } from "@/server/modules/users/user-admin.service";
import { supabaseAdmin } from "@/server/supabase/admin";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { ROLE_KEYS, type RoleKey } from "@/server/rbac/permissions";
import { parse } from "@/server/validation";

export async function listStaff(actor: Actor | null) {
  assertCan(actor, "team.manage");
  return db.user.findMany({
    where: { staffProfile: { isNot: null } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      twoFactorEnabled: true,
      staffProfile: { select: { active: true, displayName: true } },
      roles: { select: { role: { select: { key: true, name: true } } } },
    },
  });
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "validation.name").max(80),
  email: z.email("validation.email").trim().toLowerCase(),
  roles: z.array(z.enum(ROLE_KEYS)).min(1, "validation.roles"),
});

/**
 * Create a staff account and email an invitation (sent by Supabase). The link opens the set-password page;
 * existing accounts are given staff roles and a password-reset link instead.
 */
export async function inviteStaff(actor: Actor | null, raw: unknown) {
  assertCan(actor, "team.manage");
  const input = parse(inviteSchema, raw);

  const admin = supabaseAdmin();
  const setPassword = authCallbackUrl("/en/auth/reset-password");
  let user = await db.user.findUnique({ where: { email: input.email } });
  let invited = false;
  if (!user?.authUserId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { data: { full_name: input.name }, redirectTo: setPassword });
    if (error || !data.user) throw new AppError("VALIDATION", "errors.validation", { fields: { email: "validation.invalid" }, supabase: error?.message });
    invited = true;
    user = user
      ? await db.user.update({ where: { id: user.id }, data: { authUserId: data.user.id } })
      : await db.user.create({ data: { authUserId: data.user.id, email: input.email, name: input.name, customerProfile: { create: {} } } });
  }
  const staffUser = user;

  await db.$transaction(async (tx) => {
    await tx.staffProfile.upsert({
      where: { userId: staffUser.id },
      create: { userId: staffUser.id, displayName: input.name },
      update: { active: true, deactivatedAt: null, displayName: input.name },
    });
    await replaceRoles(tx, staffUser.id, input.roles);
    await audit(tx, actor, { action: "team.invite", entityType: "User", entityId: staffUser.id, after: { roles: input.roles } });
  });

  // Already had a Supabase login: send a reset link so they can set a password for the console.
  if (!invited) await admin.auth.resetPasswordForEmail(input.email, { redirectTo: setPassword });
  return { userId: staffUser.id };
}

async function replaceRoles(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], userId: string, roles: RoleKey[]) {
  const rows = await tx.role.findMany({ where: { key: { in: roles } }, select: { id: true } });
  await tx.userRole.deleteMany({ where: { userId } });
  await tx.userRole.createMany({ data: rows.map((r) => ({ userId, roleId: r.id })) });
}

async function activeOwnerCount(excludeUserId?: string) {
  return db.user.count({
    where: { id: excludeUserId ? { not: excludeUserId } : undefined, staffProfile: { active: true }, roles: { some: { role: { key: "owner" } } } },
  });
}

export async function setStaffRoles(actor: Actor | null, userId: string, roles: RoleKey[]) {
  assertCan(actor, "team.manage");
  const parsed = parse(z.array(z.enum(ROLE_KEYS)).min(1, "validation.roles"), roles);
  const before = await db.userRole.findMany({ where: { userId }, select: { role: { select: { key: true } } } });
  if (!(await db.staffProfile.findUnique({ where: { userId } }))) throw notFound("user");
  const wasOwner = before.some((r) => r.role.key === "owner");
  if (wasOwner && !parsed.includes("owner") && (await activeOwnerCount(userId)) === 0) throw new AppError("CONFLICT", "errors.team.lastOwner");

  await db.$transaction(async (tx) => {
    await replaceRoles(tx, userId, parsed);
    await audit(tx, actor, { action: "team.roles", entityType: "User", entityId: userId, before: before.map((r) => r.role.key), after: parsed });
  });
}

/** Deactivation revokes all sessions immediately (offboarding, PRD §13.4). */
export async function setStaffActive(actor: Actor | null, userId: string, active: boolean) {
  assertCan(actor, "team.manage");
  if (userId === actor.userId && !active) throw new AppError("CONFLICT", "errors.team.selfDeactivate");
  const profile = await db.staffProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound("user");
  const isOwner = await db.userRole.findFirst({ where: { userId, role: { key: "owner" } } });
  if (!active && isOwner && (await activeOwnerCount(userId)) === 0) throw new AppError("CONFLICT", "errors.team.lastOwner");

  await db.$transaction(async (tx) => {
    await tx.staffProfile.update({ where: { userId }, data: { active, deactivatedAt: active ? null : new Date() } });
    if (!active) {
      await tx.repairAssignment.updateMany({ where: { technicianId: userId, active: true }, data: { active: false, endedAt: new Date() } });
    }
    await audit(tx, actor, { action: active ? "team.reactivate" : "team.deactivate", entityType: "User", entityId: userId });
  });
  if (!active) await revokeSessions(await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, authUserId: true } }));
}

export async function listAudit(actor: Actor | null, filter: { entityType?: string; actorId?: string; page?: number } = {}) {
  assertCan(actor, "audit.view_all", "audit.view_limited");
  const pageSize = 50;
  const page = Math.max(1, filter.page ?? 1);
  // Limited audit: operational records only, not team/settings changes.
  const limited = !actor.permissions.has("audit.view_all");
  const where = {
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(limited ? { entityType: { in: ["RepairJob", "RepairBooking"] } } : {}),
  };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.auditLog.count({ where }),
  ]);
  const actorIds = [...new Set(items.map((i) => i.actorId).filter((x): x is string => !!x))];
  const people = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  return { items, total, page, pageSize, names: Object.fromEntries(people.map((p) => [p.id, p.name])) };
}

const ownProfileSchema = z.object({
  name: z.string().trim().min(2, "validation.name").max(80),
  displayName: z.string().trim().min(2, "validation.name").max(80),
  preferredLocale: z.enum(["en", "hi"]),
});

/** "My profile" in the console: any staff member edits their own name, display name and language. */
export async function updateOwnStaffProfile(actor: Actor | null, raw: unknown) {
  if (!actor?.isStaff) throw new AppError("FORBIDDEN", "errors.forbidden");
  const input = parse(ownProfileSchema, raw);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.userId }, data: { name: input.name, preferredLocale: input.preferredLocale } });
    await tx.staffProfile.update({ where: { userId: actor.userId }, data: { displayName: input.displayName } });
    await audit(tx, actor, { action: "team.own_profile", entityType: "User", entityId: actor.userId, after: input });
  });
}
