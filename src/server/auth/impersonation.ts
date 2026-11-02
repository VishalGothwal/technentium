import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * "Switch user": an admin with `user.impersonate` views and acts as another account to test what that person
 * sees. The admin keeps their own Supabase session; this signed, short-lived cookie names the target, and
 * `getActor` honours it only for the admin who created it while they still hold the permission.
 */
export const VIEW_AS_COOKIE = "tn_view_as";
export const VIEW_AS_TTL_SECONDS = 60 * 60;

function key(): Buffer | null {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return secret ? createHash("sha256").update(`technentium:view-as:${secret}`).digest() : null;
}

const sign = (k: Buffer, payload: string) => createHmac("sha256", k).update(payload).digest("base64url");

export function encodeViewAs(targetUserId: string, byUserId: string, now = Date.now()): string | null {
  const k = key();
  if (!k) return null;
  const payload = `${targetUserId}.${byUserId}.${now + VIEW_AS_TTL_SECONDS * 1000}`;
  return `${payload}.${sign(k, payload)}`;
}

export function decodeViewAs(value: string | undefined, now = Date.now()): { targetUserId: string; byUserId: string } | null {
  const k = key();
  if (!k || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [targetUserId, byUserId, exp, sig] = parts;
  const expected = Buffer.from(sign(k, `${targetUserId}.${byUserId}.${exp}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (!(Number(exp) > now)) return null;
  return { targetUserId, byUserId };
}

export async function readViewAsCookie() {
  return decodeViewAs((await cookies()).get(VIEW_AS_COOKIE)?.value);
}

export async function writeViewAsCookie(value: string | null) {
  const store = await cookies();
  if (!value) return store.delete(VIEW_AS_COOKIE);
  store.set(VIEW_AS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_AS_TTL_SECONDS,
  });
}
