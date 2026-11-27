/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(value: string | null | undefined, fallback: string): string {
  // URL parsing drops tabs/newlines and reads "\" as "/", so "/\t/evil.com" would leave the site.
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(value)) return fallback;
  return value;
}
