import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { requireCustomerPage } from "@/server/auth/guards";
import { listMyCustomizations } from "@/server/modules/customization/customization.service";
import { CUSTOMIZATION_TONE } from "@/server/modules/customization/state";
import { readConfig } from "@/lib/customization/config";
import { formatDate, formatPaise } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { ConfigPreview } from "@/components/customization/config-preview";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("studio.account.title"), robots: { index: false } };
}

export default async function MyDesignsPage() {
  const { t, locale } = await getT();
  const requests = await listMyCustomizations(await requireCustomerPage(locale, `/${locale}/account/designs`));

  return (
    <>
      <PageHeader title={t("studio.account.title")} actions={<ButtonLink href={`/${locale}/customize/studio`}>{t("studio.account.start")}</ButtonLink>} />
      {requests.length === 0 ? (
        <EmptyState title={t("studio.account.empty")} action={<ButtonLink href={`/${locale}/customize`}>{t("studio.hero.browse")}</ButtonLink>} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {requests.map((r) => {
            const c = readConfig(r.configuration);
            const designName = c?.design ? localized(locale, c.design.nameEn, c.design.nameHi) : t("studio.design.blank");
            return (
              <li key={r.reference}>
                <Link href={`/${locale}/account/designs/${r.reference}`} className="flex gap-4 rounded-[var(--radius)] border border-border bg-surface p-3 hover:border-primary/40">
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-[#14161f] p-1.5">
                    <ConfigPreview configuration={r.configuration} label={t("studio.preview.generic")} className="h-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge tone={CUSTOMIZATION_TONE[r.status]}>{t(`studio.status.${r.status}`)}</Badge>
                    <p className="mt-2 truncate font-medium">
                      {r.deviceModel.brand.name} {r.deviceModel.name}
                    </p>
                    <p className="truncate text-sm text-muted">{designName}</p>
                    <p className="mt-1 text-xs text-muted">
                      {r.reference} · {t("studio.account.submittedOn", { date: formatDate(r.createdAt, locale) })}
                    </p>
                    <p className="mt-1 text-sm">
                      {r.quotedPaise != null
                        ? t("studio.account.quoted", { price: formatPaise(r.quotedPaise, locale) })
                        : r.estimatePaise != null
                          ? t("studio.account.estimate", { price: formatPaise(r.estimatePaise, locale) })
                          : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
