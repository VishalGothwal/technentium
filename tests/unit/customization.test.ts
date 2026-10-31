import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_PRICE_PAISE, estimatePaise } from "@/lib/customization/pricing";
import { DEFAULT_STYLE, readStyle } from "@/lib/customization/style";
import { readConfig } from "@/lib/customization/config";
import {
  canShareQuote,
  CUSTOMER_CANCELLABLE,
  CUSTOMIZATION_RULES,
  customizationStep,
  findCustomizationRule,
  staffTargets,
  TERMINAL_CUSTOMIZATION_STATUSES,
} from "@/server/modules/customization/state";

describe("customization estimate", () => {
  it("adds finish and coverage deltas to the design base price", () => {
    expect(estimatePaise({ basePricePaise: 59900, finishDeltaPaise: 15000, coverageDeltaPaise: 9900 })).toEqual({ basePaise: 59900, finishPaise: 15000, coveragePaise: 9900, totalPaise: 84800 });
  });
  it("falls back to the default base for blank or unpriced designs", () => {
    expect(estimatePaise({ basePricePaise: null, finishDeltaPaise: 0, coverageDeltaPaise: 0 }).totalPaise).toBe(DEFAULT_BASE_PRICE_PAISE);
    expect(estimatePaise({ basePricePaise: undefined, finishDeltaPaise: 100, coverageDeltaPaise: 0 }).totalPaise).toBe(DEFAULT_BASE_PRICE_PAISE + 100);
  });
  it("keeps a zero base price (free promotional design)", () => {
    expect(estimatePaise({ basePricePaise: 0, finishDeltaPaise: 0, coverageDeltaPaise: 0 }).totalPaise).toBe(0);
  });
});

describe("customization transitions", () => {
  it("follows the happy path", () => {
    expect(findCustomizationRule("SUBMITTED", "UNDER_REVIEW", "staff")).toBeDefined();
    expect(findCustomizationRule("UNDER_REVIEW", "FEASIBILITY_CONFIRMED", "staff")).toBeDefined();
    expect(findCustomizationRule("FEASIBILITY_CONFIRMED", "QUOTE_SHARED", "staff", "quote")).toBeDefined();
    expect(findCustomizationRule("QUOTE_SHARED", "ACCEPTED", "customer", "decision")).toBeDefined();
    expect(findCustomizationRule("ACCEPTED", "COMPLETED", "staff")).toBeDefined();
  });

  it("only the customer decides on a shared price", () => {
    expect(findCustomizationRule("QUOTE_SHARED", "ACCEPTED", "staff", "decision")).toBeUndefined();
    expect(findCustomizationRule("QUOTE_SHARED", "ACCEPTED", "staff")).toBeUndefined();
    expect(staffTargets("QUOTE_SHARED")).not.toContain("ACCEPTED");
  });

  it("price sharing is only reachable through the dedicated quote action", () => {
    expect(findCustomizationRule("UNDER_REVIEW", "QUOTE_SHARED", "staff")).toBeUndefined();
    expect(staffTargets("UNDER_REVIEW")).not.toContain("QUOTE_SHARED");
    expect(canShareQuote("UNDER_REVIEW")).toBe(true);
    expect(canShareQuote("QUOTE_SHARED")).toBe(true); // revision
    expect(canShareQuote("SUBMITTED")).toBe(false);
    expect(canShareQuote("ACCEPTED")).toBe(false);
  });

  it("requires reasons for info requests, declines and staff cancellations", () => {
    expect(findCustomizationRule("UNDER_REVIEW", "NEEDS_INFO", "staff")?.requiresReason).toBe(true);
    expect(findCustomizationRule("UNDER_REVIEW", "DECLINED", "staff")?.requiresReason).toBe(true);
    expect(findCustomizationRule("ACCEPTED", "CANCELLED", "staff")?.requiresReason).toBe(true);
  });

  it("lets customers cancel only before a price is shared", () => {
    for (const s of CUSTOMER_CANCELLABLE) expect(findCustomizationRule(s, "CANCELLED", "customer")).toBeDefined();
    expect(findCustomizationRule("QUOTE_SHARED", "CANCELLED", "customer")).toBeUndefined();
    expect(findCustomizationRule("ACCEPTED", "CANCELLED", "customer")).toBeUndefined();
  });

  it("has no transitions out of terminal states", () => {
    for (const rule of CUSTOMIZATION_RULES) for (const t of TERMINAL_CUSTOMIZATION_STATUSES) expect(rule.from).not.toContain(t);
  });

  it("maps statuses to customer tracking steps", () => {
    expect(customizationStep("SUBMITTED")).toBe("submitted");
    expect(customizationStep("NEEDS_INFO")).toBe("review");
    expect(customizationStep("FEASIBILITY_CONFIRMED")).toBe("review");
    expect(customizationStep("QUOTE_SHARED")).toBe("quote");
    expect(customizationStep("ACCEPTED")).toBe("accepted");
    expect(customizationStep("COMPLETED")).toBe("completed");
  });
});

describe("stored design data", () => {
  it("falls back to a neutral style for malformed rows", () => {
    expect(readStyle({ pattern: "nope", palette: ["#fff"] })).toEqual(DEFAULT_STYLE);
    expect(readStyle({ pattern: "waves", palette: ["#000000", "#ffffff"] })).toMatchObject({ pattern: "waves", density: 5, angle: 45 });
  });
  it("rejects configuration snapshots that don't match the schema", () => {
    expect(readConfig({ version: 2 })).toBeNull();
    expect(readConfig(null)).toBeNull();
  });
});
