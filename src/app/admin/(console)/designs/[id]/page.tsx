import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { isAppError } from "@/server/errors";
import { getDesignAdmin } from "@/server/modules/customization/design-admin.service";
import { PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { DesignForm, type DesignFormValues } from "../design-form";

export const instant = false;
export const metadata = { title: "Edit design" };

const EMPTY: DesignFormValues = {
  slug: "",
  nameEn: "",
  nameHi: "",
  descriptionEn: "",
  descriptionHi: "",
  collection: "minimal",
  style: { pattern: "waves", palette: ["#0b3c49", "#2ec4b6", "#cbf3f0"], density: 5, angle: 45 },
  basePricePaise: null,
  featured: false,
  active: true,
  sortOrder: 100,
};

export default async function DesignEditPage({ params }: PageProps<"/admin/designs/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "customization.manage")) return <NoAccess />;
  const { id } = await params;
  if (id === "new") {
    return (
      <>
        <PageHeader title="New design" />
        <DesignForm id={null} initial={EMPTY} />
      </>
    );
  }
  let d;
  try {
    d = await getDesignAdmin(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <>
      <PageHeader title={`Edit “${d.nameEn}”`} />
      <DesignForm
        id={d.id}
        initial={{
          slug: d.slug,
          nameEn: d.nameEn,
          nameHi: d.nameHi ?? "",
          descriptionEn: d.descriptionEn ?? "",
          descriptionHi: d.descriptionHi ?? "",
          collection: d.collection as DesignFormValues["collection"],
          style: d.style,
          basePricePaise: d.basePricePaise,
          featured: d.featured,
          active: d.active,
          sortOrder: d.sortOrder,
        }}
      />
    </>
  );
}
