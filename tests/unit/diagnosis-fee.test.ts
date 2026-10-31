import { describe, expect, it } from "vitest";
import { resolveDiagnosisFee, type FeeRule } from "@/server/modules/pricing/diagnosis-fee";

const rule = (id: string, feePaise: number, scope: Partial<Pick<FeeRule, "categoryId" | "modelId" | "issueTypeId">>, waived = true): FeeRule => ({
  id,
  feePaise,
  categoryId: null,
  modelId: null,
  issueTypeId: null,
  waivedIfApproved: waived,
  ...scope,
});

const ctx = { categoryId: "phone", modelId: "iphone13", issueTypeIds: ["screen"] };

describe("resolveDiagnosisFee", () => {
  it("falls back to the default when no rule matches", () => {
    expect(resolveDiagnosisFee([], ctx, 19900)).toEqual({ feePaise: 19900, waivedIfApproved: true, ruleId: null });
  });

  it("prefers model+issue over model over issue over category", () => {
    const rules = [
      rule("cat", 10000, { categoryId: "phone" }),
      rule("issue", 20000, { issueTypeId: "screen" }),
      rule("model", 30000, { modelId: "iphone13" }),
      rule("both", 5000, { modelId: "iphone13", issueTypeId: "screen" }),
    ];
    expect(resolveDiagnosisFee(rules, ctx, 0).ruleId).toBe("both");
    expect(resolveDiagnosisFee(rules.slice(0, 3), ctx, 0).ruleId).toBe("model");
    expect(resolveDiagnosisFee(rules.slice(0, 2), ctx, 0).ruleId).toBe("issue");
    expect(resolveDiagnosisFee(rules.slice(0, 1), ctx, 0).ruleId).toBe("cat");
  });

  it("ignores rules for other categories/models/issues", () => {
    const rules = [rule("other", 99999, { modelId: "pixel" }), rule("laptop", 99999, { categoryId: "laptop" })];
    expect(resolveDiagnosisFee(rules, ctx, 100).ruleId).toBeNull();
  });

  it("charges the highest fee across multiple issues", () => {
    const rules = [rule("screen", 15000, { issueTypeId: "screen" }), rule("board", 40000, { issueTypeId: "board" }, false)];
    const fee = resolveDiagnosisFee(rules, { ...ctx, issueTypeIds: ["screen", "board"] }, 0);
    expect(fee).toEqual({ feePaise: 40000, waivedIfApproved: false, ruleId: "board" });
  });
});
