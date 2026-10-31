/**
 * Quote arithmetic in integer paise (PRD §9.3: no floating-point money).
 * The server is the only place totals are computed; client-sent totals are ignored (FR-QUOTE-04).
 */
export type MoneyLine = {
  kind: "LABOUR" | "PART" | "DIAGNOSIS_FEE" | "DISCOUNT" | "OTHER";
  quantity: number;
  unitPaise: number; // always >= 0; DISCOUNT lines are subtracted
  taxable: boolean;
};

export type Totals = {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
};

/** a / b rounded half-up, for non-negative integers. */
export function divRoundHalfUp(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b <= 0) {
    throw new RangeError("divRoundHalfUp expects non-negative safe integers");
  }
  return Math.floor((2 * a + b) / (2 * b));
}

export function lineAmount(line: MoneyLine): number {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new RangeError("quantity must be a positive integer");
  if (!Number.isInteger(line.unitPaise) || line.unitPaise < 0) throw new RangeError("unitPaise must be a non-negative integer");
  return line.quantity * line.unitPaise;
}

/**
 * subtotal = sum of charge lines
 * discount = sum of discount lines (cannot exceed subtotal)
 * tax      = GST on the taxable share of (charges − discount); discount is apportioned
 *            between taxable and non-taxable charges by value
 * total    = subtotal − discount + tax
 */
export function computeTotals(lines: MoneyLine[], taxRateBps: number): Totals {
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0) throw new RangeError("taxRateBps must be a non-negative integer");

  let subtotal = 0;
  let taxableCharges = 0;
  let discount = 0;

  for (const line of lines) {
    const amount = lineAmount(line);
    if (line.kind === "DISCOUNT") {
      discount += amount;
    } else {
      subtotal += amount;
      if (line.taxable) taxableCharges += amount;
    }
  }

  if (discount > subtotal) throw new RangeError("discount cannot exceed subtotal");

  const taxableDiscount = subtotal === 0 ? 0 : divRoundHalfUp(discount * taxableCharges, subtotal);
  const taxableBase = taxableCharges - taxableDiscount;
  const tax = divRoundHalfUp(taxableBase * taxRateBps, 10_000);

  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    taxPaise: tax,
    totalPaise: subtotal - discount + tax,
  };
}
