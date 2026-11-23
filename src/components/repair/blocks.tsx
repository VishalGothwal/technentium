import Link from "next/link";
import type { TFunction } from "@/i18n/translate";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { Rail } from "@/components/shop/rail";
import { BrandLogo } from "@/components/ui/brand-logo";
import { DeviceArt, IssueIcon } from "./visuals";

/** Building blocks shared by the repair landing, category, brand and model pages. */

export const TILE = "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface text-center shadow-sm lift hover:border-primary";

export function SectionTitle({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("text-2xl font-bold tracking-tight", className)}>
      {children}
    </h2>
  );
}

/** Brand tiles: just the brand's logo (or its name when we have none); the model count is in the tooltip. */
export function BrandGrid({
  brands,
  hrefFor,
  t,
  className,
}: {
  brands: { id: string; slug: string; name: string; _count?: { models: number } }[];
  hrefFor: (slug: string) => string;
  t: TFunction;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6", className)}>
      {brands.map((b) => (
        <li key={b.id}>
          <Link
            href={hrefFor(b.slug)}
            title={b._count ? `${b.name} · ${t("repairFlow.modelsCount", { count: b._count.models })}` : b.name}
            className={cn(TILE, "h-24 px-3 sm:h-28")}
          >
            <BrandLogo slug={b.slug} name={b.name} className="max-w-full" fallbackClassName="text-xl font-extrabold tracking-tight" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BrandRail({ brands, hrefFor, label }: { brands: { id: string; slug: string; name: string }[]; hrefFor: (slug: string) => string; label: string }) {
  return (
    <Rail label={label} listClassName="gap-3 py-1">
      {brands.map((b) => (
        <li key={b.id} className="w-32 shrink-0 snap-start">
          <Link href={hrefFor(b.slug)} title={b.name} className={cn(TILE, "h-24 px-3")}>
            <BrandLogo slug={b.slug} name={b.name} scale={0.85} className="max-w-full" fallbackClassName="text-lg font-extrabold tracking-tight" />
          </Link>
        </li>
      ))}
    </Rail>
  );
}

/** Repair services as icon tiles in a scrollable row. */
export function ServiceRail({ services, href, label }: { services: { id: string; slug: string; name: string }[]; href: string; label: string }) {
  return (
    <Rail label={label} listClassName="gap-3 py-1">
      {services.map((s) => (
        <li key={s.id} className="w-36 shrink-0 snap-start sm:w-40">
          <Link href={href} className={cn(TILE, "h-40 px-3")}>
            <IssueIcon slug={s.slug} className="size-14 text-foreground" />
            <span className="text-xs leading-snug font-semibold tracking-wide uppercase">{s.name}</span>
          </Link>
        </li>
      ))}
    </Rail>
  );
}

/** Stock photos for device types whose models have no photo yet (sources in docs/category-image-sources.csv). */
const TYPE_COVERS: Record<string, string> = {
  tablet: "/devices/tablet.png",
  laptop: "/devices/laptop.png",
  smartwatch: "/devices/smartwatch.png",
  audio: "/devices/audio.png",
};

/** A device type (phone, tablet…): a model's photo, else the stock photo, else the drawn outline. */
export function DeviceTypeTile({ href, slug, name, imageId }: { href: string; slug: string; name: string; imageId?: string | null }) {
  const src = imageId ? mediaUrl(imageId) : TYPE_COVERS[slug];
  return (
    <Link href={href} className={cn(TILE, "h-32 px-2 pt-3 pb-2.5 sm:h-40 sm:px-3 sm:pt-4 sm:pb-3")}>
      <span className="flex h-16 w-full items-center justify-center sm:h-24">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- media route redirects to signed storage URLs
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
        ) : (
          <DeviceArt category={slug} className="size-16 text-foreground" />
        )}
      </span>
      <span className="text-xs leading-tight font-semibold sm:text-sm">{name}</span>
    </Link>
  );
}

export function ModelTile({ href, name, category, sub, imageId }: { href: string; name: string; category: string; sub?: string; imageId?: string | null }) {
  return (
    <Link href={href} className={cn(TILE, "h-full min-h-40 px-3 py-4")}>
      {imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the media route (redirects to signed storage URLs)
        <img src={mediaUrl(imageId)} alt={name} loading="lazy" decoding="async" className="h-36 w-full object-contain" />
      ) : (
        <DeviceArt category={category} className="size-16 text-foreground" />
      )}
      <span className="text-sm leading-snug font-medium">{name}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Link>
  );
}

const WHY = ["pricing", "approval", "tracking", "warranty"] as const;
const WHY_ICONS = ["₹", "✓", "◎", "★"];

export function WhyUs({ t }: { t: TFunction }) {
  return (
    <section className="mt-16 bg-primary-soft py-12" aria-labelledby="why-title">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle id="why-title">{t("repairFlow.whyTitle")}</SectionTitle>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((k, i) => (
            <li key={k} className="flex gap-3">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-lg font-bold text-primary shadow-sm">
                {WHY_ICONS[i]}
              </span>
              <div>
                <p className="font-semibold">{t(`home.trust.${k}.title`)}</p>
                <p className="text-sm text-muted">{t(`home.trust.${k}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function RepairFaq({ t, className }: { t: TFunction; className?: string }) {
  return (
    <section className={className} aria-labelledby="faq-title">
      <SectionTitle id="faq-title">{t("repairs.faqTitle")}</SectionTitle>
      <div className="mt-3 divide-y divide-border border-b border-border">
        {(["1", "2", "3"] as const).map((n) => (
          <details key={n} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              {t(`repairs.faq.q${n}`)}
              <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-2 text-sm text-muted">{t(`repairs.faq.a${n}`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
