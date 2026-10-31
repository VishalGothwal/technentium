import Link from "next/link";
import { notFound } from "next/navigation";
import { createT } from "@/i18n/translate";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { getPreview } from "@/server/modules/content/content.admin";
import { resolveTargets } from "@/server/modules/content/content.queries";
import type { RelationTarget } from "@/lib/schemas/content";
import { strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";
import { ArticleView } from "@/components/content/article-view";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };
export const instant = false;

/** Staff-only draft preview (FR-CMS-07): renders the saved translation exactly as readers will see it. */
export default async function PreviewPage({ params, searchParams }: PageProps<"/admin/content/[id]/preview">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const { id } = await params;
  const locale = strParam((await searchParams).locale) === "hi" ? "hi" : "en";
  let data;
  try {
    data = await getPreview(actor, id, locale);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { item, t: tr } = data;
  const t = createT(locale);
  const relationTargets = item.relations.map((r) => ({ targetType: r.targetType as RelationTarget, targetId: r.targetId }));
  const blockTargets = tr.body.flatMap((b) => (b.type === "related" ? b.items : []));
  const [explicitRelated, blockLinks] = await Promise.all([resolveTargets(relationTargets, locale), resolveTargets(blockTargets, locale)]);

  return (
    <div className="-m-4 bg-background sm:-m-6" lang={locale}>
      <ArticleView
        locale={locale}
        t={t}
        shareUrl={`/${locale}/${item.type === "VIDEO" ? "videos" : "articles"}/${item.slug}`}
        banner={
          <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-warning-soft px-4 py-2 text-sm text-foreground">
            <span>
              <strong>Preview</strong> · {locale === "en" ? "English" : "Hindi"} · status <strong>{tr.status.toLowerCase()}</strong> — not visible to customers unless published. Links to unpublished items are hidden.
            </span>
            <Link href={`/admin/content/${item.id}`} className="font-medium underline">
              Back to editor
            </Link>
          </div>
        }
        data={{
          type: item.type,
          slug: item.slug,
          topic: item.topic,
          tags: item.tags,
          title: tr.title,
          summary: tr.summary,
          body: tr.body,
          authorName: item.author.name,
          publishedAt: tr.publishedAt ?? new Date(),
          updatedAt: tr.updatedAt,
          readingMinutes: tr.readingMinutes,
          coverMediaId: item.coverMediaId,
          videoUrl: item.videoUrl,
          isFallback: false,
          shownLocale: locale,
          explicitRelated,
          blockLinks,
          autoRelated: [],
          newer: null,
          older: null,
        }}
      />
    </div>
  );
}
