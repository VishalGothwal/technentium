import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { isAppError } from "@/server/errors";
import { getDevice3dModel } from "@/server/modules/catalog/device-3d-admin.service";
import { mediaUrl } from "@/lib/media";
import { PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { Model3dForm } from "../model-form";

export const instant = false;
export const metadata = { title: "Edit 3D model" };

export default async function Model3dEditPage({ params }: PageProps<"/admin/models-3d/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "catalog.manage")) return <NoAccess />;
  const { id } = await params;
  if (id === "new") {
    return (
      <>
        <PageHeader title="New 3D model" />
        <Model3dForm id={null} initial={{ slug: "", name: "", frame: "square-corner", params: {}, notes: "", active: true }} file={null} devices={[]} />
      </>
    );
  }
  let m;
  try {
    m = await getDevice3dModel(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <>
      <PageHeader title={`Edit “${m.name}”`} />
      <Model3dForm
        id={m.id}
        initial={{ slug: m.slug, name: m.name, frame: m.frame, params: m.params, notes: m.notes ?? "", active: m.active }}
        file={m.file ? { url: mediaUrl(m.file.id), sizeBytes: m.file.sizeBytes } : null}
        devices={m.devices.map((d) => ({ id: d.id, name: `${d.brand.name} ${d.name}`, kind: d.category.slug }))}
      />
    </>
  );
}
