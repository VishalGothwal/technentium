/**
 * Diagnosis-fee resolution (FR-QUOTE-10/11). Pure so it can be unit-tested and shown on the
 * booking review step exactly as it will be stored.
 *
 * For each selected issue, pick the most specific active rule:
 *   model+issue (4) > model (3) > issue (2) > category (1) > default setting (0)
 * The booking fee is the highest fee across the selected issues (one diagnosis per device visit).
 */
export type FeeRule = {
  id: string;
  categoryId: string | null;
  modelId: string | null;
  issueTypeId: string | null;
  feePaise: number;
  waivedIfApproved: boolean;
};

export type FeeContext = { categoryId: string; modelId: string; issueTypeIds: string[] };

export type ResolvedFee = { feePaise: number; waivedIfApproved: boolean; ruleId: string | null };

function specificity(rule: FeeRule, ctx: FeeContext, issueTypeId: string): number {
  if (rule.categoryId && rule.categoryId !== ctx.categoryId) return -1;
  if (rule.modelId && rule.modelId !== ctx.modelId) return -1;
  if (rule.issueTypeId && rule.issueTypeId !== issueTypeId) return -1;
  if (rule.modelId && rule.issueTypeId) return 4;
  if (rule.modelId) return 3;
  if (rule.issueTypeId) return 2;
  if (rule.categoryId) return 1;
  return 0;
}

export function resolveDiagnosisFee(rules: FeeRule[], ctx: FeeContext, defaultFeePaise: number): ResolvedFee {
  const fallback: ResolvedFee = { feePaise: defaultFeePaise, waivedIfApproved: true, ruleId: null };
  if (ctx.issueTypeIds.length === 0) return fallback;

  let best: ResolvedFee | null = null;
  for (const issueTypeId of ctx.issueTypeIds) {
    let pick: { rule: FeeRule; score: number } | null = null;
    for (const rule of rules) {
      const score = specificity(rule, ctx, issueTypeId);
      if (score < 0) continue;
      if (!pick || score > pick.score || (score === pick.score && rule.feePaise > pick.rule.feePaise)) {
        pick = { rule, score };
      }
    }
    const fee: ResolvedFee = pick
      ? { feePaise: pick.rule.feePaise, waivedIfApproved: pick.rule.waivedIfApproved, ruleId: pick.rule.id }
      : fallback;
    if (!best || fee.feePaise > best.feePaise) best = fee;
  }
  return best ?? fallback;
}
