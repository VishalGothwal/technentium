import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/guide", title: t("guide.title"), description: t("guide.intro") });
}

export default async function GuidePage() {
  const { t, locale } = await getT();
  const items = ["backup", "lock", "accounts", "sim", "charge", "notes"] as const;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t("guide.title")}</h1>
      <p className="mt-2 text-muted">{t("guide.intro")}</p>
      <ol className="mt-8 space-y-3">
        {items.map((k, i) => (
          <li key={k} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{i + 1}</span>
            <span>{t(`guide.items.${k}`)}</span>
          </li>
        ))}
      </ol>
      <ButtonLink href={`/${locale}/repairs/book`} className="mt-8">
        {t("home.cta")}
      </ButtonLink>
    </div>
  );
}
