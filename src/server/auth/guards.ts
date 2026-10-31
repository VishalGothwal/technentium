import "server-only";
import { redirect } from "next/navigation";
import { getActor } from "./session";
import type { Actor } from "@/server/rbac/actor";

/** Signed-in customer for a page, or redirect to sign-in (returning to `next`). */
export async function requireCustomerPage(locale: string, next: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/${locale}/auth/sign-in?next=${encodeURIComponent(next)}`);
  return actor;
}

/** Signed-in, active staff member for an admin page, or redirect to the staff sign-in. */
export async function requireStaffPage(): Promise<Actor> {
  const actor = await getActor();
  if (!actor || !actor.isStaff) redirect("/admin/sign-in");
  return actor;
}
