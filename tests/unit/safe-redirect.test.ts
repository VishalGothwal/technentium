import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/en/account?tab=orders", "/")).toBe("/en/account?tab=orders");
  });

  it("refuses anything a browser would resolve off-site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "\\/evil.com"]) {
      expect(safeNext(bad, "/fallback")).toBe("/fallback");
      expect(new URL(safeNext(bad, "/fallback"), "https://shop.in").origin).toBe("https://shop.in");
    }
  });
});
