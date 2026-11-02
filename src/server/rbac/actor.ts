import { AppError } from "@/server/errors";
import type { Permission, RoleKey } from "./permissions";

/** The authenticated principal every service receives. Built once per request in `server/auth/session.ts`. */
export type Actor = {
  userId: string;
  name: string;
  roles: RoleKey[];
  permissions: ReadonlySet<Permission>;
  /** true when the user holds any staff role and the staff profile is active */
  isStaff: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  /** The admin who switched into this account ("view as"); every audit entry records them too. */
  impersonator?: { userId: string; name: string } | null;
  /** Staff account with two-factor on, signed in without the second step yet: staff powers withheld. */
  needsSecondFactor?: boolean;
};

export const can = (actor: Actor | null | undefined, permission: Permission): boolean =>
  !!actor && actor.permissions.has(permission);

export const canAny = (actor: Actor | null | undefined, ...permissions: Permission[]): boolean =>
  permissions.some((p) => can(actor, p));

export function assertCan(actor: Actor | null | undefined, ...anyOf: Permission[]): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  if (!canAny(actor, ...anyOf)) throw new AppError("FORBIDDEN", "errors.forbidden");
}

export function assertStaff(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "errors.unauthenticated");
  if (!actor.isStaff) throw new AppError("FORBIDDEN", "errors.forbidden");
}
