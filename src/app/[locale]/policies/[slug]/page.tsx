import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { Alert } from "@/components/ui/surface";

const POLICIES = ["privacy", "terms", "repair"] as const;
type Policy = (typeof POLICIES)[number];
const isPolicy = (s: string): s is Policy => (POLICIES as readonly string[]).includes(s);

export async function generateStaticParams() {
  return POLICIES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { t, locale } = await getT();
  return isPolicy(slug)
    ? pageMetadata({ locale, path: `/policies/${slug}`, title: t(`policies.${slug}.title`), description: t(`policies.${slug}.body`).slice(0, 160) })
    : {};
}

export default async function PolicyPage({ params }: PageProps<"/[locale]/policies/[slug]">) {
  const { slug } = await params;
  if (!isPolicy(slug)) notFound();
  const { t } = await getT();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t(`policies.${slug}.title`)}</h1>
      <Alert tone="warning" className="mt-4">
        {t("common.draftNotice")}
      </Alert>
      <p className="mt-6 leading-relaxed">{t(`policies.${slug}.body`)}</p>
    </article>
  );
}
