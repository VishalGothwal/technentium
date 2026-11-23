import { cn } from "@/lib/cn";

/**
 * Brand logos in public/brands/<slug>.png (sources and licences in docs/brand-logo-sources.csv), each with the
 * display height in px (at brand-tile size) that makes it look the same size as the others: wide wordmarks
 * shorter, round marks taller. Brands not listed show their name.
 */
const BRAND_LOGOS: Record<string, number> = {
  acer: 26,
  apple: 44,
  asus: 23,
  boat: 34,
  dell: 46,
  google: 44,
  hp: 46,
  infinix: 23,
  iqoo: 21,
  lava: 22,
  lenovo: 23,
  motorola: 44,
  noise: 23,
  nothing: 22,
  oneplus: 44,
  oppo: 25,
  poco: 40,
  realme: 32,
  samsung: 26,
  sony: 21,
  tecno: 22,
  vivo: 24,
  xiaomi: 44,
};

export const hasBrandLogo = (slug: string) => slug in BRAND_LOGOS;

/**
 * The brand's logo scaled from tile size (`scale` 1), or its name in `fallbackClassName` when there is no logo.
 * `max` caps the height so round marks don't tower over wordmarks in small chips.
 */
export function BrandLogo({ slug, name, scale = 1, max, className, fallbackClassName }: { slug: string; name: string; scale?: number; max?: number; className?: string; fallbackClassName?: string }) {
  const base = BRAND_LOGOS[slug];
  if (!base) return <span className={fallbackClassName}>{name}</span>;
  const height = Math.min(Math.round(base * scale), max ?? Infinity);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static logo files
    <img src={`/brands/${slug}.png`} alt={name} loading="lazy" decoding="async" style={{ height }} className={cn("w-auto max-w-none shrink-0 object-contain", className)} />
  );
}
