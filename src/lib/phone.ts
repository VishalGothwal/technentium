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

export const isValidPincode = (input: string) => /^[1-9]\d{5}$/.test(input);
