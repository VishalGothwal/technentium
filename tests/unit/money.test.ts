import { describe, expect, it } from "vitest";
import { computeTotals, divRoundHalfUp, type MoneyLine } from "@/server/modules/quotes/money";
import { rupeesToPaise } from "@/lib/format";

const line = (kind: MoneyLine["kind"], unitPaise: number, quantity = 1, taxable = true): MoneyLine => ({
  kind,
  unitPaise,
  quantity,
  taxable,
});

describe("divRoundHalfUp", () => {
  it("rounds halves up", () => {
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(4, 2)).toBe(2);
    expect(divRoundHalfUp(1, 3)).toBe(0);
    expect(divRoundHalfUp(2, 3)).toBe(1);
  });
  it("rejects negatives and non-integers", () => {
    expect(() => divRoundHalfUp(-1, 2)).toThrow();
    expect(() => divRoundHalfUp(1.5, 2)).toThrow();
    expect(() => divRoundHalfUp(1, 0)).toThrow();
  });
});

describe("computeTotals", () => {
  it("returns zeros for an empty quote", () => {
    expect(computeTotals([], 1800)).toEqual({ subtotalPaise: 0, discountPaise: 0, taxPaise: 0, totalPaise: 0 });
  });

  it("sums charges and applies GST on taxable lines", () => {
    const t = computeTotals([line("LABOUR", 50000), line("PART", 120000, 2)], 1800);
    expect(t.subtotalPaise).toBe(290000);
    expect(t.taxPaise).toBe(52200);
    expect(t.totalPaise).toBe(342200);
  });

  it("does not tax non-taxable lines", () => {
    const t = computeTotals([line("LABOUR", 10000), line("OTHER", 5000, 1, false)], 1800);
    expect(t.taxPaise).toBe(1800);
    expect(t.totalPaise).toBe(16800);
  });

  it("apportions discount between taxable and non-taxable charges", () => {
    // 10000 taxable + 10000 non-taxable, 2000 discount → 1000 off the taxable base
    const t = computeTotals([line("LABOUR", 10000), line("OTHER", 10000, 1, false), line("DISCOUNT", 2000)], 1800);
    expect(t.discountPaise).toBe(2000);
    expect(t.taxPaise).toBe(1620); // 18% of 9000
    expect(t.totalPaise).toBe(20000 - 2000 + 1620);
  });

  it("rounds tax half-up to the paisa", () => {
    // 18% of 1 paisa*... 0.18 → 0 ; 18% of 3 = 0.54 → 1
    expect(computeTotals([line("LABOUR", 3)], 1800).taxPaise).toBe(1);
    expect(computeTotals([line("LABOUR", 2)], 1800).taxPaise).toBe(0);
  });

  it("rejects discounts larger than the subtotal", () => {
    expect(() => computeTotals([line("LABOUR", 100), line("DISCOUNT", 101)], 0)).toThrow();
  });

  it("rejects invalid quantities and prices", () => {
    expect(() => computeTotals([line("LABOUR", 100, 0)], 0)).toThrow();
    expect(() => computeTotals([line("LABOUR", -1)], 0)).toThrow();
    expect(() => computeTotals([line("LABOUR", 10.5)], 0)).toThrow();
  });
});

describe("rupeesToPaise", () => {
  it("parses common inputs", () => {
    expect(rupeesToPaise("1,299.50")).toBe(129950);
    expect(rupeesToPaise("₹ 499")).toBe(49900);
    expect(rupeesToPaise("0.5")).toBe(50);
  });
  it("rejects invalid inputs", () => {
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
  });
});
