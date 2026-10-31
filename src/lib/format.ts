/** Display helpers shared by server and client. Business timezone is Asia/Kolkata. */
export const TIMEZONE = "Asia/Kolkata";

const intlLocale = (locale: string) => (locale === "hi" ? "hi-IN" : "en-IN");

export function formatPaise(paise: number, locale = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatDateTime(value: Date | string, locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(value));
}

export function formatDate(value: Date | string, locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIMEZONE }).format(new Date(value));
}

/** Rupees string from a form ("1,299.50") → integer paise. Returns null if invalid. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
