import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { localized, type TFunction } from "@/i18n/translate";
import { pageMetadata } from "@/lib/seo";
import { deviceName } from "@/lib/device-name";
import { cn } from "@/lib/cn";
import { getRepairModel } from "@/server/modules/catalog/repair-pages.service";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { RepairFaq } from "@/components/repair/blocks";
import { ServicePicker } from "@/components/repair/service-picker";
import { DeviceArt } from "@/components/repair/visuals";
import { DeviceFrame } from "@/components/device/device-frame";
import { CUSTOMIZABLE_CATEGORIES, deviceKindFor } from "@/lib/customization/style";

export const instant = false;

type Props = PageProps<"/[locale]/repairs/[category]/[brand]/[model]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, brand, model } = await params;
  const { t, locale } = await getT();
  const data = await getRepairModel(category, brand, model);
  if (!data) return { title: t("errors.notFound.device"), robots: { index: false } };
  const m = data.model;
  return pageMetadata({
    locale,
    path: `/repairs/${m.category.slug}/${m.brand.slug}/${m.slug}`,
    title: t("repairFlow.brandTitle", { brand: deviceName(m.brand.name, m.name) }),
    description: t("repairs.subtitle"),
  });
}

export default async function RepairModelPage({ params }: Props) {
  const { category, brand, model } = await params;
  const { t, locale } = await getT();
  const data = await getRepairModel(category, brand, model);
  if (!data) notFound();
  const { model: m, services, fee } = data;
  const name = deviceName(m.brand.name, m.name);
  const catBase = `/${locale}/repairs/${m.category.slug}`;
  const brandBase = `${catBase}/${m.brand.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 lg:pb-16">
      <Breadcrumbs
        items={[
          { name: t("nav.repairs"), path: `/${locale}/repairs` },
          { name: localized(locale, m.category.nameEn, m.category.nameHi), path: catBase },
          { name: m.brand.name, path: brandBase },
          { name: m.name, path: `${brandBase}/${m.slug}` },
        ]}
      />

      <div className="mt-5 flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4 sm:w-64 sm:shrink-0">
          {(CUSTOMIZABLE_CATEGORIES as readonly string[]).includes(m.category.slug) ? (
            // The model's own outline (front + back camera layout) so customers can confirm the device.
            <span className="flex h-24 shrink-0 items-end gap-1.5 rounded-xl bg-surface-muted px-3 py-2.5">
              <DeviceFrame frame={m.frame} kind={deviceKindFor(m.category.slug)} view="front" className="h-full w-auto" />
              <DeviceFrame frame={m.frame} kind={deviceKindFor(m.category.slug)} view="back" className="h-full w-auto" />
            </span>
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
              <DeviceArt category={m.category.slug} className="size-14 text-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl leading-tight font-bold tracking-tight sm:text-2xl">{name}</h1>
            <Link href={brandBase} className="text-sm font-semibold text-primary hover:underline">
              {t("repairFlow.changeDevice")}
            </Link>
          </div>
        </div>
        <Stepper t={t} className="sm:flex-1" />
      </div>

      <div className="mt-6">
        <ServicePicker
          modelId={m.id}
          initialFee={fee ? { feePaise: fee.feePaise, waivedIfApproved: fee.waivedIfApproved } : null}
          services={services.map((s) => ({
            id: s.id,
            slug: s.slug,
            name: localized(locale, s.nameEn, s.nameHi),
            description: localized(locale, s.descriptionEn ?? "", s.descriptionHi) || null,
            estimate: s.estimate,
          }))}
        />
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-xl bg-surface-muted p-4 text-sm lg:mr-94">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-lg">
          🛠
        </span>
        <p>
          <span className="font-semibold">{t("repairFlow.otherIssueTitle")} </span>
          <span className="text-muted">{t("repairFlow.otherIssueBody")}</span>
        </p>
      </div>

      <RepairFaq t={t} className="mt-10 lg:mr-94" />
    </div>
  );
}

/** Device → repair → checkout progress, with the middle step current. */
function Stepper({ t, className }: { t: TFunction; className?: string }) {
  const steps = [t("repairFlow.stepDevice"), t("repairFlow.stepServices"), t("repairFlow.stepCheckout")];
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((label, i) => (
        <li key={label} className="relative flex flex-1 flex-col items-center gap-2 text-center" aria-current={i === 1 ? "step" : undefined}>
          {i > 0 && <span aria-hidden className={cn("absolute top-5 right-1/2 h-0.5 w-full", i <= 1 ? "bg-primary" : "bg-border")} />}
          <span
            className={cn(
              "relative z-10 flex size-10 items-center justify-center rounded-full text-sm font-bold ring-4 ring-surface",
              i < 1 ? "bg-primary text-white" : i === 1 ? "bg-primary text-white shadow-lg shadow-primary/30" : "border-2 border-border bg-surface text-muted",
            )}
          >
            {i < 1 ? "✓" : i + 1}
          </span>
          <span className={cn("text-xs sm:text-sm", i <= 1 ? "font-semibold" : "text-muted")}>{label}</span>
        </li>
      ))}
    </ol>
  );
}
