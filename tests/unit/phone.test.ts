import { describe, expect, it } from "vitest";
import { formatNational, isCompleteNational, nationalDigits, normalizeIndianMobile } from "@/lib/phone";

describe("phone entry", () => {
  it("keeps only the 10 national digits from typed or pasted numbers", () => {
    expect(nationalDigits("98765 43210")).toBe("9876543210");
    expect(nationalDigits("+91 98765-43210")).toBe("9876543210");
    expect(nationalDigits("919876543210")).toBe("9876543210");
    expect(nationalDigits("098765 43210")).toBe("9876543210");
    expect(nationalDigits("98765432109999")).toBe("9876543210");
    expect(nationalDigits("98a76")).toBe("9876");
  });

  it("formats as 5 + 5 digits while typing", () => {
    expect(formatNational("98765")).toBe("98765");
    expect(formatNational("987654")).toBe("98765 4");
    expect(formatNational("9876543210")).toBe("98765 43210");
  });

  it("only accepts 10-digit numbers starting 6–9", () => {
    expect(isCompleteNational("9876543210")).toBe(true);
    expect(isCompleteNational("6123456789")).toBe(true);
    expect(isCompleteNational("5645444440")).toBe(false);
    expect(isCompleteNational("987654321")).toBe(false);
  });

  it("round-trips with the E.164 normaliser the server uses", () => {
    expect(normalizeIndianMobile(nationalDigits("+91 98765 43210"))).toBe("+919876543210");
  });
});
