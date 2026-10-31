import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { describeTargets, getContentForEdit } from "@/server/modules/content/content.admin";
import type { RelationTarget } from "@/lib/schemas/content";
import { NoAccess } from "@/components/admin/no-access";
import { ContentEditor, type EditorTranslation } from "@/components/admin/content/content-editor";

export const metadata = { title: "Edit content" };
export const instant = false;

export default async function EditContentPage({ params }: PageProps<"/admin/content/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const { id } = await params;
  let item;
  try {
    item = await getContentForEdit(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const blockTargets = item.translations.flatMap((t) => t.body.flatMap((b) => (b.type === "related" ? b.items : [])));
  const [relations, blockLabels] = await Promise.all([
    describeTargets(actor, item.relations.map((r) => ({ targetType: r.targetType as RelationTarget, targetId: r.targetId }))),
    describeTargets(actor, blockTargets),
  ]);
  const translations: Partial<Record<"en" | "hi", EditorTranslation>> = {};
  for (const t of item.translations) {
    if (t.locale !== "en" && t.locale !== "hi") continue;
    translations[t.locale] = {
      title: t.title,
      summary: t.summary,
      body: t.body,
      seoTitle: t.seoTitle,
      metaDescription: t.metaDescription,
      status: t.status,
      scheduledAt: t.scheduledAt?.toISOString() ?? null,
      publishedAt: t.publishedAt?.toISOString() ?? null,
      revisions: t.revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), authorName: r.authorName })),
    };
  }
  return (
    <ContentEditor
      canPublish={can(actor, "content.publish")}
      initial={{
        id: item.id,
        type: item.type,
        slug: item.slug,
        topic: item.topic,
        tags: item.tags,
        coverMediaId: item.coverMediaId,
        videoUrl: item.videoUrl,
        featured: item.featured,
        updatedAt: item.updatedAt.toISOString(),
        translations,
        relations,
        blockLabels,
      }}
    />
  );
}
