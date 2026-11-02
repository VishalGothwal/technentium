import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeViewAs, encodeViewAs, VIEW_AS_TTL_SECONDS } from "@/server/auth/impersonation";

describe("switch user cookie", () => {
  const saved = process.env.SUPABASE_SECRET_KEY;
  beforeEach(() => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test_key_for_signing_only";
  });
  afterEach(() => {
    process.env.SUPABASE_SECRET_KEY = saved;
  });

  it("round-trips target and admin", () => {
    const v = encodeViewAs("target1", "admin1")!;
    expect(decodeViewAs(v)).toEqual({ targetUserId: "target1", byUserId: "admin1" });
  });

  it("rejects a changed target, admin or expiry", () => {
    const [target, by, exp, sig] = encodeViewAs("target1", "admin1")!.split(".");
    expect(decodeViewAs([`${target}x`, by, exp, sig].join("."))).toBeNull();
    expect(decodeViewAs([target, "admin2", exp, sig].join("."))).toBeNull();
    expect(decodeViewAs([target, by, String(Number(exp) + 1000), sig].join("."))).toBeNull();
    expect(decodeViewAs("garbage")).toBeNull();
    expect(decodeViewAs(undefined)).toBeNull();
  });

  it("expires after the TTL", () => {
    const now = Date.now();
    const v = encodeViewAs("t", "a", now)!;
    expect(decodeViewAs(v, now + (VIEW_AS_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(decodeViewAs(v, now + VIEW_AS_TTL_SECONDS * 1000 + 1)).toBeNull();
  });

  it("is refused when signed with a different secret, and unavailable without one", () => {
    const v = encodeViewAs("t", "a")!;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_another_key_entirely_000";
    expect(decodeViewAs(v)).toBeNull();
    delete process.env.SUPABASE_SECRET_KEY;
    expect(encodeViewAs("t", "a")).toBeNull();
    expect(decodeViewAs(v)).toBeNull();
  });
});
