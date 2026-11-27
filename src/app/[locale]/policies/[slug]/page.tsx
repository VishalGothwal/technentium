import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { getSetting } from "@/server/settings";
import { Alert, Skeleton } from "@/components/ui/surface";

const POLICIES = ["privacy", "terms", "refund", "cookies", "repair"] as const;
type Policy = (typeof POLICIES)[number];
const isPolicy = (s: string): s is Policy => (POLICIES as readonly string[]).includes(s);

export async function generateStaticParams() {
  return POLICIES.map((slug) => ({ slug }));
}

/** First paragraph without markup, for the meta description. */
const summary = (body: string) =>
  body
    .split("\n\n")
    .find((b) => !b.startsWith("## "))
    ?.replace(/^- /gm, "")
    .slice(0, 160) ?? "";

export async function generateMetadata({ params }: PageProps<"/[locale]/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { t, locale } = await getT();
  return isPolicy(slug) ? pageMetadata({ locale, path: `/policies/${slug}`, title: t(`policies.${slug}.title`), description: summary(t(`policies.${slug}.body`)) }) : {};
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
      <Suspense fallback={<Skeleton className="mt-6 h-96" />}>
        <PolicyBody slug={slug} />
      </Suspense>
    </article>
  );
}

/**
 * Policy text lives in the message files: blocks separated by a blank line, "## " starts a heading and
 * "- " lines form a list. {email}, {phone} and {address} come from Admin → Settings (cached like the Help page).
 */
async function PolicyBody({ slug }: { slug: Policy }) {
  "use cache";
  const [{ t }, email, phone, address] = await Promise.all([
    getT(),
    getSetting("business.supportEmail"),
    getSetting("business.supportPhone"),
    getSetting("business.shopAddress"),
  ]);
  const blocks = t(`policies.${slug}.body`, { email, phone, address }).split("\n\n");
  return (
    <div className="mt-6 space-y-4 leading-relaxed">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) return <h2 key={i} className="pt-4 text-xl font-semibold">{block.slice(3)}</h2>;
        const lines = block.split("\n");
        const items = lines.filter((l) => l.startsWith("- "));
        const intro = lines.filter((l) => !l.startsWith("- ")).join(" ");
        return (
          <div key={i} className="space-y-2">
            {intro && <p>{intro}</p>}
            {items.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {items.map((l) => (
                  <li key={l}>{l.slice(2)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
