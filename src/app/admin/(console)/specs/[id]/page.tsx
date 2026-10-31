import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { getSpecForEdit } from "@/server/modules/content/specs.admin";
import { deviceName } from "@/lib/content/specs";
import { NoAccess } from "@/components/admin/no-access";
import { SpecEditor } from "@/components/admin/content/spec-editor";

export const metadata = { title: "Spec sheet" };
export const instant = false;

export default async function EditSpecPage({ params }: PageProps<"/admin/specs/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const { id } = await params;
  let s;
  try {
    s = await getSpecForEdit(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <SpecEditor
      canPublish={can(actor, "content.publish")}
      initial={{
        id: s.id,
        deviceModelId: s.deviceModelId,
        deviceName: deviceName(s.deviceModel.brand.name, s.deviceModel.name),
        slug: s.slug,
        status: s.status,
        releaseDate: s.releaseDate?.toISOString().slice(0, 10) ?? null,
        launchPricePaise: s.launchPricePaise,
        summaryEn: s.summaryEn ?? "",
        summaryHi: s.summaryHi ?? "",
        imageMediaId: s.imageMediaId,
        seoTitle: s.seoTitle ?? "",
        metaDescription: s.metaDescription ?? "",
        specs: s.specs,
      }}
    />
  );
}
