import "server-only";
import { cookies, headers } from "next/headers";
import type { Actor } from "@/server/rbac/actor";
import { CART_COOKIE, CART_TOKEN_HEADER, type CartIdentity } from "./cart.service";

/**
 * Request-scoped cart identity: the signed-in actor plus the guest token from the httpOnly cookie
 * (web) or the `X-Cart-Token` header (mobile apps that don't keep cookies).
 */
export async function cartIdentity(actor: Actor | null): Promise<CartIdentity> {
  const fromCookie = (await cookies()).get(CART_COOKIE)?.value ?? null;
  const fromHeader = (await headers()).get(CART_TOKEN_HEADER);
  return { actor, guestToken: fromCookie ?? fromHeader ?? null };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/** Persist a newly issued guest token. Only callable from Server Actions and Route Handlers. */
export async function rememberGuestToken(token: string | null) {
  if (token) (await cookies()).set(CART_COOKIE, token, COOKIE_OPTIONS);
}

/** Drop the guest token once its cart has been merged into the signed-in user's cart. */
export async function forgetGuestToken() {
  const jar = await cookies();
  if (jar.get(CART_COOKIE)) jar.delete(CART_COOKIE);
}
