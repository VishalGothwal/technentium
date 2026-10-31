/** Indicative price for a design without its own base price ("blank" skins and older designs). */
export const DEFAULT_BASE_PRICE_PAISE = 59900;

/**
 * Indicative estimate shown in the studio (FR-CUSTOM-10: no checkout). Staff confirm the real
 * price after a feasibility check, so this is always labelled as an estimate.
 */
export function estimatePaise(input: { basePricePaise: number | null | undefined; finishDeltaPaise: number; coverageDeltaPaise: number }) {
  const base = input.basePricePaise ?? DEFAULT_BASE_PRICE_PAISE;
  const total = base + input.finishDeltaPaise + input.coverageDeltaPaise;
  return { basePaise: base, finishPaise: input.finishDeltaPaise, coveragePaise: input.coverageDeltaPaise, totalPaise: Math.max(0, total) };
}
