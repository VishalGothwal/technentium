import "server-only";
import type { User as AuthUser } from "@supabase/supabase-js";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getFeatures } from "@/server/features";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/server/providers/email";
import { normalizeIndianMobile } from "@/lib/phone";

/** Supabase stores phones as digits without "+"; the app keeps E.164 Indian mobiles ("+919876543210"). */
export const appPhone = (raw: string | null | undefined) => (raw ? normalizeIndianMobile(raw.startsWith("+") ? raw : `+${raw}`) : null);

const placeholderEmail = (phone: string | null, authUserId: string) => `${phone ? phone.replace("+", "") : authUserId}@${PLACEHOLDER_EMAIL_DOMAIN}`;

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * The app user for a Supabase Auth user, linking or creating it on first sign-in:
 *  1. already linked by `authUserId` → that user;
 *  2. an unlinked account (created before the move to Supabase, or by seed) with the same *verified* email
 *     or phone → link it, so existing bookings and orders carry over;
 *  3. otherwise create a customer account — unless new sign-ups are switched off (returns null).
 */
export async function appUserIdFor(authUserId: string, fetchUser: () => Promise<AuthUser | null>): Promise<string | null> {
  const linked = await db.user.findUnique({
    where: { authUserId },
    select: { id: true },
  });
  if (linked) return linked.id;

  const u = await fetchUser();
  if (!u || u.id !== authUserId) return null;
  const email = u.email ? u.email.trim().toLowerCase() : null;
  const emailOk = !!email && !!u.email_confirmed_at;
  const phone = appPhone(u.phone);
  const phoneOk = !!phone && !!u.phone_confirmed_at;

  const match: Prisma.UserWhereInput[] = [];
  if (emailOk) match.push({ email });
  if (phoneOk) match.push({ phoneNumber: phone });
  if (match.length) {
    const existing = await db.user.findFirst({
      where: { authUserId: null, OR: match },
      select: { id: true },
    });
    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          authUserId,
          ...(emailOk ? { emailVerified: true } : {}),
          ...(phoneOk ? { phoneNumber: phone, phoneNumberVerified: true } : {}),
        },
      });
      return existing.id;
    }
  }

  if (!(await getFeatures()).signUp) return null;

  const meta = (u.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    locale?: string;
    avatar_url?: string;
  };
  const emailFree = email ? !(await db.user.findUnique({ where: { email }, select: { id: true } })) : false;
  const phoneFree = phone
    ? !(await db.user.findUnique({
        where: { phoneNumber: phone },
        select: { id: true },
      }))
    : false;
  try {
    const created = await db.user.create({
      data: {
        authUserId,
        name: (meta.full_name ?? meta.name ?? "").trim().slice(0, 80) || "Customer",
        email: email && emailFree ? email : placeholderEmail(phoneFree ? phone : null, authUserId),
        emailVerified: emailOk && emailFree,
        phoneNumber: phoneFree ? phone : null,
        phoneNumberVerified: phoneFree && phoneOk,
        image: meta.avatar_url ?? null,
        preferredLocale: meta.locale === "hi" ? "hi" : "en",
        customerProfile: { create: {} },
      },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    // Two first requests raced; the other one created the link.
    if (!isUniqueViolation(e)) throw e;
    return (
      (
        await db.user.findUnique({
          where: { authUserId },
          select: { id: true },
        })
      )?.id ?? null
    );
  }
}

/** Keep the app copy of a linked user's email and phone in step with Supabase after a confirmed change. */
export async function syncContact(userId: string, u: AuthUser) {
  const data: Prisma.UserUpdateInput = {};
  const email = u.email?.trim().toLowerCase();
  if (email && u.email_confirmed_at) Object.assign(data, { email, emailVerified: true });
  const phone = appPhone(u.phone);
  if (phone && u.phone_confirmed_at) Object.assign(data, { phoneNumber: phone, phoneNumberVerified: true });
  data.lastSignInAt = new Date();
  try {
    await db.user.update({ where: { id: userId }, data });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // The address belongs to another app account; keep ours and only stamp the sign-in.
    await db.user.update({
      where: { id: userId },
      data: { lastSignInAt: new Date() },
    });
  }
}
