import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";
import { ContentEditor } from "@/components/admin/content/content-editor";

export const metadata = { title: "New content" };
export const instant = false;

export default async function NewContentPage({ searchParams }: PageProps<"/admin/content/new">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const type = strParam((await searchParams).type) === "VIDEO" ? "VIDEO" : "ARTICLE";
  return (
    <ContentEditor
      canPublish={can(actor, "content.publish")}
      initial={{
        type,
        slug: "",
        topic: type === "VIDEO" ? "repair-guides" : "tips",
        tags: [],
        coverMediaId: null,
        videoUrl: null,
        featured: false,
        translations: {},
        relations: [],
        blockLabels: [],
      }}
    />
  );
}
