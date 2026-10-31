/** Repair estimate resolution — pure so it can be unit tested without a database. */

export type EstimateRow = { issueTypeId: string; modelId: string | null; minPaise: number; maxPaise: number | null };
export type Estimate = { minPaise: number; maxPaise: number | null };

/** The model-specific row wins over the issue-wide default; null when neither exists. */
export function pickEstimate(rows: EstimateRow[], issueTypeId: string, modelId: string): Estimate | null {
  const row = rows.find((r) => r.issueTypeId === issueTypeId && r.modelId === modelId) ?? rows.find((r) => r.issueTypeId === issueTypeId && r.modelId === null);
  return row ? { minPaise: row.minPaise, maxPaise: row.maxPaise && row.maxPaise > row.minPaise ? row.maxPaise : null } : null;
}

/** Sum of the selected estimates as a range; services without an estimate are counted separately. */
export function sumEstimates(estimates: (Estimate | null)[]) {
  let min = 0;
  let max = 0;
  let unpriced = 0;
  for (const e of estimates) {
    if (!e) {
      unpriced++;
      continue;
    }
    min += e.minPaise;
    max += e.maxPaise ?? e.minPaise;
  }
  return { minPaise: min, maxPaise: max > min ? max : null, unpriced };
}
