import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { deviceName, SPEC_TEMPLATE } from "@/lib/content/specs";
import { strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";
import { SpecEditor } from "@/components/admin/content/spec-editor";

export const metadata = { title: "New spec sheet" };
export const instant = false;

export default async function NewSpecPage({ searchParams }: PageProps<"/admin/specs/new">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const modelId = strParam((await searchParams).model);
  const model = modelId ? await db.deviceModel.findUnique({ where: { id: modelId }, include: { brand: true, specification: { select: { id: true } } } }) : null;
  if (!model) notFound();
  const name = deviceName(model.brand.name, model.name);
  return (
    <SpecEditor
      canPublish={can(actor, "content.publish")}
      initial={{
        id: null,
        deviceModelId: model.id,
        deviceName: name,
        slug: `${model.brand.slug}-${model.slug}`,
        status: "DRAFT",
        releaseDate: model.releaseYear ? `${model.releaseYear}-01-01` : null,
        launchPricePaise: null,
        summaryEn: "",
        summaryHi: "",
        imageMediaId: null,
        seoTitle: "",
        metaDescription: "",
        specs: SPEC_TEMPLATE,
      }}
    />
  );
}
