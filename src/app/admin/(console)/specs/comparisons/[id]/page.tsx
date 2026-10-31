import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { getComparisonForEdit, specOptions } from "@/server/modules/content/specs.admin";
import { deviceName } from "@/lib/content/specs";
import { NoAccess } from "@/components/admin/no-access";
import { ComparisonEditor, type ComparisonEditorInitial } from "@/components/admin/content/spec-editor";

export const metadata = { title: "Comparison" };
export const instant = false;

/** `/admin/specs/comparisons/new` creates; any other id edits. */
export default async function ComparisonEditPage({ params }: PageProps<"/admin/specs/comparisons/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const { id } = await params;
  const options = (await specOptions(actor)).map((o) => ({ id: o.id, status: o.status, label: deviceName(o.deviceModel.brand.name, o.deviceModel.name) }));

  let initial: ComparisonEditorInitial = {
    id: null,
    status: "DRAFT",
    slug: "",
    titleEn: "",
    titleHi: "",
    introEn: "",
    introHi: "",
    verdictEn: "",
    verdictHi: "",
    seoTitle: "",
    metaDescription: "",
    specIds: [],
  };
  if (id !== "new") {
    try {
      const c = await getComparisonForEdit(actor, id);
      initial = {
        id: c.id,
        status: c.status,
        slug: c.slug,
        titleEn: c.titleEn,
        titleHi: c.titleHi ?? "",
        introEn: c.introEn ?? "",
        introHi: c.introHi ?? "",
        verdictEn: c.verdictEn ?? "",
        verdictHi: c.verdictHi ?? "",
        seoTitle: c.seoTitle ?? "",
        metaDescription: c.metaDescription ?? "",
        specIds: c.devices.map((d) => d.specId),
      };
    } catch (e) {
      if (isAppError(e) && e.code === "NOT_FOUND") notFound();
      throw e;
    }
  }
  return <ComparisonEditor initial={initial} options={options} canPublish={can(actor, "content.publish")} />;
}
