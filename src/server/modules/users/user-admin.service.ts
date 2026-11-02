import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { authCallbackUrl } from "@/server/auth/flows";
import { encodeViewAs, writeViewAsCookie } from "@/server/auth/impersonation";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { getFeatures } from "@/server/features";
import { isDeliverableEmail } from "@/server/providers/email";
import { assertCan, type Actor } from "@/server/rbac/actor";
import { supabaseAdmin, supabaseAdminConfigured } from "@/server/supabase/admin";
import { createSupabaseStatelessClient } from "@/server/supabase/server";
import { parse } from "@/server/validation";
import { LOCALES } from "@/i18n/config";
import { normalizeIndianMobile } from "@/lib/phone";

/**
 * Users & access: the Owner's controls over every account (customers and staff). App data lives in `users`;
 * sign-in details live in Supabase Auth and are changed through its admin API (needs SUPABASE_SECRET_KEY).
 */

export type UserKind = "all" | "customers" | "staff" | "blocked";

export async function listUsers(actor: Actor | null, filter: { q?: string; kind?: UserKind; page?: number } = {}) {
  assertCan(actor, "user.manage");
  const pageSize = 25;
  const page = Math.max(1, filter.page ?? 1);
  const q = filter.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(filter.kind === "staff" ? { staffProfile: { isNot: null } } : {}),
    ...(filter.kind === "customers" ? { staffProfile: null } : {}),
    ...(filter.kind === "blocked" ? { blockedAt: { not: null } } : {}),
    ...(q
      ? {
          OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phoneNumber: { contains: q } }],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        authUserId: true,
        blockedAt: true,
        lastSignInAt: true,
        createdAt: true,
        staffProfile: { select: { active: true } },
        roles: { select: { role: { select: { key: true, name: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    items: items.map((u) => ({
      ...u,
      email: isDeliverableEmail(u.email) ? u.email : null,
    })),
    total,
    page,
    pageSize,
  };
}

/** One account with its Supabase sign-in details (providers, confirmations, factors) when linked. */
export async function getUserDetail(actor: Actor | null, userId: string) {
  assertCan(actor, "user.manage");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      authUserId: true,
      name: true,
      email: true,
      emailVerified: true,
      phoneNumber: true,
      phoneNumberVerified: true,
      preferredLocale: true,
      twoFactorEnabled: true,
      blockedAt: true,
      blockedReason: true,
      lastSignInAt: true,
      sessionsRevokedAt: true,
      createdAt: true,
      staffProfile: { select: { displayName: true, active: true } },
      roles: { select: { role: { select: { key: true, name: true } } } },
      _count: {
        select: {
          bookings: true,
          productRequests: true,
          customizationRequests: true,
        },
      },
    },
  });
  if (!user) throw notFound("user");

  let auth: {
    providers: string[];
    emailConfirmed: boolean;
    phoneConfirmed: boolean;
    lastSignInAt: string | null;
    factors: number;
  } | null = null;
  let authError: string | null = null;
  if (user.authUserId && supabaseAdminConfigured()) {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(user.authUserId);
    if (error || !data.user) authError = error?.message ?? "Not found in Supabase Auth";
    else {
      const u = data.user;
      auth = {
        providers: (u.identities ?? []).map((i) => i.provider),
        emailConfirmed: !!u.email_confirmed_at,
        phoneConfirmed: !!u.phone_confirmed_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        factors: (u.factors ?? []).filter((f) => f.status === "verified").length,
      };
    }
  }
  return {
    ...user,
    email: isDeliverableEmail(user.email) ? user.email : null,
    roleKeys: user.roles.map((r) => r.role.key),
    auth,
    authError,
    adminConfigured: supabaseAdminConfigured(),
  };
}

const isOwner = async (userId: string) =>
  !!(await db.userRole.findFirst({
    where: { userId, role: { key: "owner" } },
  }));

async function activeOwnersExcept(userId: string) {
  return db.user.count({
    where: {
      id: { not: userId },
      blockedAt: null,
      staffProfile: { active: true },
      roles: { some: { role: { key: "owner" } } },
    },
  });
}

async function loadTarget(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      authUserId: true,
      email: true,
      name: true,
      phoneNumber: true,
    },
  });
  if (!user) throw notFound("user");
  return user;
}

/** Map Supabase admin errors to a readable validation message instead of a 500. */
function authFailure(error: { message: string; code?: string } | null): never | void {
  if (!error) return;
  const field = error.code === "email_exists" ? "email" : error.code === "phone_exists" ? "phoneNumber" : "form";
  throw new AppError("VALIDATION", "errors.validation", {
    fields: {
      [field]: error.code === "email_exists" || error.code === "phone_exists" ? "validation.taken" : "validation.invalid",
    },
    supabase: error.message,
  });
}

export const userProfileSchema = z.object({
  name: z.string().trim().min(2, "validation.name").max(80),
  email: z.union([z.email("validation.email").trim().toLowerCase().max(200), z.literal("")]).optional(),
  phoneNumber: z.string().trim().max(20).optional(),
  preferredLocale: z.enum(LOCALES),
  displayName: z.string().trim().max(80).optional(),
});

/** Edit any account's profile. Email and phone change in Supabase Auth too, already confirmed (an admin vouches for them). */
export async function updateUserProfile(actor: Actor | null, userId: string, raw: unknown) {
  assertCan(actor, "user.manage");
  const input = parse(userProfileSchema, raw);
  const before = await loadTarget(userId);
  const phone = input.phoneNumber ? normalizeIndianMobile(input.phoneNumber) : null;
  if (input.phoneNumber && !phone)
    throw new AppError("VALIDATION", "errors.validation", {
      fields: { phoneNumber: "validation.phone" },
    });
  const email = input.email || null;

  const clash = await db.user.findFirst({
    where: {
      id: { not: userId },
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phoneNumber: phone }] : [])],
    },
    select: { email: true },
  });
  if (clash)
    throw new AppError("VALIDATION", "errors.validation", {
      fields: {
        [clash.email === email ? "email" : "phoneNumber"]: "validation.taken",
      },
    });

  if (before.authUserId && supabaseAdminConfigured()) {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(before.authUserId, {
      ...(email && email !== before.email ? { email, email_confirm: true } : {}),
      ...(phone && phone !== before.phoneNumber ? { phone, phone_confirm: true } : {}),
      user_metadata: { full_name: input.name, locale: input.preferredLocale },
    });
    authFailure(error);
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        preferredLocale: input.preferredLocale,
        ...(email ? { email, emailVerified: true } : {}),
        phoneNumber: phone,
        ...(phone ? { phoneNumberVerified: true } : {}),
      },
    });
    if (input.displayName)
      await tx.staffProfile.updateMany({
        where: { userId },
        data: { displayName: input.displayName },
      });
    await audit(tx, actor, {
      action: "user.profile",
      entityType: "User",
      entityId: userId,
      before,
      after: { ...input, email, phoneNumber: phone },
    });
  });
}

/**
 * Delete the person's Supabase sessions (refresh tokens) and refuse access tokens issued before now.
 * Call outside a transaction: the raw delete may fail (no auth schema locally) and must not abort one.
 */
export async function revokeSessions(user: { id: string; authUserId: string | null }) {
  await db.user.update({
    where: { id: user.id },
    data: { sessionsRevokedAt: new Date() },
  });
  if (!user.authUserId) return;
  // Supabase keeps sessions in auth.sessions (same database); plain Postgres in development has no auth schema.
  await db.$executeRaw`DELETE FROM auth.sessions WHERE user_id = ${user.authUserId}::uuid`.catch(() => {});
}

export async function signOutEverywhere(actor: Actor | null, userId: string) {
  assertCan(actor, "user.manage");
  const user = await loadTarget(userId);
  await revokeSessions(user);
  await db.$transaction((tx) =>
    audit(tx, actor, {
      action: "user.sign_out_all",
      entityType: "User",
      entityId: userId,
    }),
  );
}

export async function setUserBlocked(actor: Actor | null, userId: string, blocked: boolean, reason?: string) {
  assertCan(actor, "user.manage");
  if (userId === actor.userId) throw new AppError("CONFLICT", "errors.users.self");
  const user = await loadTarget(userId);
  if (blocked && (await isOwner(userId)) && (await activeOwnersExcept(userId)) === 0) throw new AppError("CONFLICT", "errors.team.lastOwner");

  if (user.authUserId && supabaseAdminConfigured()) {
    // A Supabase ban also stops sign-in from mobile apps that talk to Supabase directly.
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.authUserId, { ban_duration: blocked ? "876000h" : "none" });
    authFailure(error);
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        blockedAt: blocked ? new Date() : null,
        blockedReason: blocked ? reason?.trim().slice(0, 300) || null : null,
      },
    });
    await audit(tx, actor, {
      action: blocked ? "user.block" : "user.unblock",
      entityType: "User",
      entityId: userId,
      after: blocked ? { reason } : undefined,
    });
  });
  if (blocked) await revokeSessions(user);
}

/** Email the person a reset link (sent by Supabase). */
export async function sendPasswordReset(actor: Actor | null, userId: string) {
  assertCan(actor, "user.manage");
  const user = await loadTarget(userId);
  if (!isDeliverableEmail(user.email)) throw new AppError("CONFLICT", "errors.users.noEmail");
  const { error } = await createSupabaseStatelessClient().auth.resetPasswordForEmail(user.email, { redirectTo: authCallbackUrl("/en/auth/reset-password") });
  authFailure(error);
  await db.$transaction((tx) =>
    audit(tx, actor, {
      action: "user.password_reset_sent",
      entityType: "User",
      entityId: userId,
    }),
  );
}

/**
 * Set a password directly — handy for test accounts. Accounts that have never signed in with Supabase
 * get their Supabase login created here (email confirmed) and linked.
 */
export async function setTemporaryPassword(actor: Actor | null, userId: string, password: string) {
  assertCan(actor, "user.manage");
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new AppError("VALIDATION", "errors.validation", {
      fields: { password: "auth.passwordHint" },
    });
  }
  const user = await loadTarget(userId);
  const admin = supabaseAdmin();
  if (user.authUserId) {
    authFailure((await admin.auth.admin.updateUserById(user.authUserId, { password })).error);
  } else {
    if (!isDeliverableEmail(user.email)) throw new AppError("CONFLICT", "errors.users.noEmail");
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.name },
    });
    authFailure(error);
    await db.user.update({
      where: { id: userId },
      data: { authUserId: data.user!.id, emailVerified: true },
    });
  }
  await db.$transaction((tx) =>
    audit(tx, actor, {
      action: "user.password_set",
      entityType: "User",
      entityId: userId,
    }),
  );
}

/** Remove every two-factor factor (lost phone). The person sets it up again from Security. */
export async function resetTwoFactor(actor: Actor | null, userId: string) {
  assertCan(actor, "user.manage");
  const user = await loadTarget(userId);
  if (user.authUserId) {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.mfa.listFactors({
      userId: user.authUserId,
    });
    authFailure(error);
    for (const f of data?.factors ?? [])
      authFailure(
        (
          await admin.auth.admin.mfa.deleteFactor({
            id: f.id,
            userId: user.authUserId,
          })
        ).error,
      );
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    });
    await audit(tx, actor, {
      action: "user.two_factor_reset",
      entityType: "User",
      entityId: userId,
    });
  });
  await revokeSessions(user);
}

// ───────────── Switch user ("view as") ─────────────

/** `real` must be the signed-in admin themself (getRealActor), never an already-switched actor. */
export async function startViewAs(real: Actor | null, userId: string) {
  assertCan(real, "user.impersonate");
  if (!(await getFeatures()).impersonation) throw new AppError("CONFLICT", "errors.featureOff");
  if (userId === real.userId) throw new AppError("CONFLICT", "errors.users.self");
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, blockedAt: true },
  });
  if (!target) throw notFound("user");
  if (target.blockedAt) throw new AppError("CONFLICT", "errors.users.blocked");
  if (await isOwner(userId)) throw new AppError("FORBIDDEN", "errors.users.ownerViewAs");
  const value = encodeViewAs(userId, real.userId);
  if (!value) throw new AppError("CONFLICT", "errors.supabaseAdminMissing");
  await writeViewAsCookie(value);
  await db.$transaction((tx) =>
    audit(tx, real, {
      action: "user.view_as.start",
      entityType: "User",
      entityId: userId,
    }),
  );
}

export async function stopViewAs(real: Actor | null, targetUserId?: string) {
  await writeViewAsCookie(null);
  if (real && targetUserId)
    await db.$transaction((tx) =>
      audit(tx, real, {
        action: "user.view_as.stop",
        entityType: "User",
        entityId: targetUserId,
      }),
    );
}

/** Staff list for the "switch user" picker on the Team page and dashboard. */
export async function listSwitchableStaff(real: Actor | null) {
  if (!real?.permissions.has("user.impersonate")) return [];
  return db.user.findMany({
    where: {
      id: { not: real.userId },
      blockedAt: null,
      staffProfile: { active: true },
      roles: { none: { role: { key: "owner" } } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
}
