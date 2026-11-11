import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { TFunction } from "@/i18n/translate";
import { localized } from "@/i18n/translate";
import { specValue } from "@/lib/content/specs";
import type { SpecGroup } from "@/lib/schemas/content";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";

/** Stylised device illustration for spec pages (until editors upload product shots). */
export function DeviceIllustration({ seed, className }: { seed: string; className?: string }) {
  let h = 0;
  for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const id = `dev${h.toString(36)}`;
  return (
    <svg viewBox="0 0 120 220" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 55%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 50) % 360} 60% 30%)`} />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="108" height="212" rx="20" fill="#0f172a" />
      <rect x="11" y="9" width="98" height="202" rx="16" fill={`url(#${id})`} />
      <rect x="46" y="15" width="28" height="7" rx="3.5" fill="#0f172a" />
      <path d="M11 150 C 40 130, 80 175, 109 140 L109 195 Q109 211 93 211 L27 211 Q11 211 11 195 Z" fill="#fff" opacity="0.12" />
    </svg>
  );
}

/** A spec value, with unknown data clearly distinct from "No" / zero (FR-SPEC-04). */
export function SpecValue({ value, t }: { value: string | null; t: TFunction }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted italic">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v.01M12 11v5" />
        </svg>
        {t("specs.notAvailable")}
      </span>
    );
  }
  return <span>{value}</span>;
}

const HIGHLIGHTS: [group: string, key: string, icon: string][] = [
  ["display", "size", "M5 3h14v18H5zM9 18h6"],
  ["performance", "chipset", "M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M6 6h12v12H6z"],
  ["camera", "main", "M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  ["battery", "capacity", "M3 7h16v10H3zM21 10v4M6 10h6v4H6z"],
];

export function SpecHighlights({ specs, locale, t, compact }: { specs: SpecGroup[]; locale: Locale; t: TFunction; compact?: boolean }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2", !compact && "sm:grid-cols-4 sm:gap-3")}>
      {HIGHLIGHTS.map(([g, k, icon]) => {
        const group = specs.find((x) => x.group === g);
        const item = group?.items.find((i) => i.key === k);
        if (!item) return null;
        return (
          <div key={`${g}.${k}`} className={cn("rounded-xl bg-surface-muted", compact ? "p-2.5" : "p-4")}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                <path d={icon} />
              </svg>
              {localized(locale, item.labelEn, item.labelHi)}
            </dt>
            <dd className={cn("mt-1 font-semibold leading-snug", compact ? "text-sm" : "text-base")}>
              <SpecValue value={specValue(specs, g, k)} t={t} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Grouped specification table. */
export function SpecTable({ specs, locale, t }: { specs: SpecGroup[]; locale: Locale; t: TFunction }) {
  return (
    <div className="space-y-6">
      {specs.map((g) => (
        <section key={g.group} aria-labelledby={`spec-${g.group}`} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <h3 id={`spec-${g.group}`} className="border-b border-border bg-surface-muted/70 px-4 py-3 font-semibold sm:px-5">
            {localized(locale, g.labelEn, g.labelHi)}
          </h3>
          <dl className="divide-y divide-border">
            {g.items.map((it) => (
              <div key={it.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3 text-sm sm:px-5">
                <dt className="text-muted">{localized(locale, it.labelEn, it.labelHi)}</dt>
                <dd className="font-medium">
                  <SpecValue value={it.value} t={t} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export type SpecCardData = {
  slug: string;
  imageMediaId?: string | null;
  specs: SpecGroup[];
  summaryEn: string | null;
  summaryHi: string | null;
  deviceModel: { name: string; brand: { name: string } };
};

export function SpecCard({ spec, locale, t }: { spec: SpecCardData; locale: Locale; t: TFunction }) {
  return (
    <article className="group relative flex h-full gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {spec.imageMediaId ? (
        // White product shots melt into the tile (multiply); transparent PNGs simply sit on it.
        <span className="flex h-32 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-muted p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- media route serves re-encoded WebP */}
          <img src={mediaUrl(spec.imageMediaId)} alt="" loading="lazy" className="max-h-full max-w-full object-contain mix-blend-multiply transition group-hover:scale-105" />
        </span>
      ) : (
        <DeviceIllustration seed={spec.slug} className="h-28 w-16 shrink-0 transition group-hover:-rotate-3" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">{spec.deviceModel.brand.name}</p>
        <h3 className="text-lg font-bold leading-tight">
          <Link href={`/${locale}/specs/${spec.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">
            {spec.deviceModel.name}
          </Link>
        </h3>
        <div className="mt-3">
          <SpecHighlights specs={spec.specs} locale={locale} t={t} compact />
        </div>
      </div>
    </article>
  );
}
