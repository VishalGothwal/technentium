/** Indian mobile numbers in E.164 (+91 followed by 10 digits starting 6–9). */
const E164_IN = /^\+91[6-9]\d{9}$/;

export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let candidate = digits;
  if (/^[6-9]\d{9}$/.test(digits)) candidate = `+91${digits}`;
  else if (/^91[6-9]\d{9}$/.test(digits)) candidate = `+${digits}`;
  else if (/^0[6-9]\d{9}$/.test(digits)) candidate = `+91${digits.slice(1)}`;
  return E164_IN.test(candidate) ? candidate : null;
}

export const isValidIndianMobile = (input: string) => E164_IN.test(input);

/**
 * The 10 national digits from whatever a customer typed or pasted: "+91 98765-43210", "098765 43210",
 * "919876543210" all give "9876543210". Never longer than 10 digits.
 */
export function nationalDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/** "9876543210" → "98765 43210" (partial input formats as it grows). */
export const formatNational = (digits: string) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);

/** Ten digits starting 6–9: a dialable Indian mobile number. */
export const isCompleteNational = (digits: string) => /^[6-9]\d{9}$/.test(digits);

export const isValidPincode = (input: string) => /^[1-9]\d{5}$/.test(input);
