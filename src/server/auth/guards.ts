import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getActor, getRealActor } from "./session";
import type { Actor } from "@/server/rbac/actor";

/** Signed-in customer for a page, or redirect to sign-in (returning to `next`). */
export async function requireCustomerPage(locale: string, next: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/${locale}/auth/sign-in?next=${encodeURIComponent(next)}`);
  return actor;
}

/**
 * Signed-in, active staff member for an admin page, or redirect to the staff sign-in.
 * Staff with two-factor on are sent back to finish the authenticator step. In production an Owner without
 * two-factor is sent to Security before the page loads any data (hiding the page in the layout is not enough:
 * page segments render independently of their layout).
 */
export async function requireStaffPage({ allowWithoutTwoFactor = false }: { allowWithoutTwoFactor?: boolean } = {}): Promise<Actor> {
  const real = await getRealActor();
  if (real?.needsSecondFactor) redirect("/admin/sign-in?step=2fa");
  const actor = await getActor();
  // Switched into a customer account: show their storefront account (where the "switch back" bar is).
  if (actor?.impersonator && !actor.isStaff) redirect("/en/account");
  if (!actor || !actor.isStaff) redirect("/admin/sign-in");
  if (!allowWithoutTwoFactor && process.env.NODE_ENV === "production" && actor.roles.includes("owner")) {
    const user = await db.user.findUnique({
      where: { id: actor.userId },
      select: { twoFactorEnabled: true },
    });
    if (!user?.twoFactorEnabled) redirect("/admin/security");
  }
  return actor;
}
