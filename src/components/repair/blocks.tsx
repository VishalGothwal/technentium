import Link from "next/link";
import type { TFunction } from "@/i18n/translate";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { Rail } from "@/components/shop/rail";
import { DeviceArt, IssueIcon } from "./visuals";

/** Building blocks shared by the repair landing, category, brand and model pages. */

export const TILE = "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md";

export function SectionTitle({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("text-2xl font-bold tracking-tight", className)}>
      {children}
    </h2>
  );
}

/** Brand tiles: a large wordmark (plain text — no third-party logos) over the brand name and model count. */
export function BrandGrid({ brands, hrefFor, t }: { brands: { id: string; slug: string; name: string; _count?: { models: number } }[]; hrefFor: (slug: string) => string; t: TFunction }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {brands.map((b) => (
        <li key={b.id}>
          <Link href={hrefFor(b.slug)} className={cn(TILE, "aspect-square p-3")}>
            <span aria-hidden className="text-xl font-extrabold tracking-tight sm:text-2xl">
              {b.name}
            </span>
            <span className="text-xs text-muted">
              <span className="sr-only">{b.name} · </span>
              {b._count ? t("repairFlow.modelsCount", { count: b._count.models }) : b.name}
            </span>
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
          <Link href={hrefFor(b.slug)} className={cn(TILE, "h-24 px-2 text-lg font-extrabold tracking-tight")}>
            {b.name}
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

export function ModelTile({ href, name, category, sub, imageId }: { href: string; name: string; category: string; sub?: string; imageId?: string | null }) {
  return (
    <Link href={href} className={cn(TILE, "h-full min-h-40 px-3 py-4")}>
      {imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the media route (redirects to signed storage URLs)
        <img src={mediaUrl(imageId)} alt={name} loading="lazy" decoding="async" className="size-28 object-contain" />
      ) : (
        <DeviceArt category={category} className="size-16 text-foreground" />
      )}
      <span className="text-sm leading-snug font-medium">{name}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Link>
  );
}

const HOW_ICONS = [
  <path key="1" d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2" />,
  <path key="2" d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01" />,
  <path key="3" d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  <path key="4" d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4" />,
];

/** Four numbered steps with icon badges on the card corner. */
export function HowItWorks({ t }: { t: TFunction }) {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="how-title">
      <SectionTitle id="how-title" className="text-center">
        {t("repairFlow.howTitle")}
      </SectionTitle>
      <span aria-hidden className="mx-auto mt-2 block h-1 w-12 rounded-full bg-primary" />
      <ol className="mt-10 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n, i) => (
          <li key={n} className="relative rounded-xl border border-border bg-surface p-5 pt-6">
            <span aria-hidden className="absolute -top-5 right-4 flex size-11 items-center justify-center rounded-full bg-foreground text-white ring-4 ring-background">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {HOW_ICONS[i]}
              </svg>
            </span>
            <p className="flex items-center gap-2 font-bold text-primary">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-white">{n}</span>
              {t(`repairFlow.how${n}Title`)}
            </p>
            <p className="mt-2 text-sm text-muted">{t(`repairFlow.how${n}Body`)}</p>
          </li>
        ))}
      </ol>
    </section>
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
