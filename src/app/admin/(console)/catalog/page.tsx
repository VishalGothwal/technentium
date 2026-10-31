import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { catalogTree, listEstimatesAdmin, listPriceItemsAdmin } from "@/server/modules/catalog/catalog-admin.service";
import { PageHeader } from "@/components/ui/surface";
import { DeviceCatalogEditor, EstimatesEditor, PriceItemsEditor } from "@/components/admin/catalog/editors";

import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Devices & pricing" };
export const instant = false;

export default async function CatalogPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "catalog.manage") && !can(actor, "settings.fees")) return <NoAccess />;
  const canCatalog = can(actor, "catalog.manage");
  const canPrices = canCatalog || can(actor, "settings.fees");
  const [tree, priceItems, estimates] = await Promise.all([
    catalogTree(actor),
    canPrices ? listPriceItemsAdmin(actor) : Promise.resolve([]),
    canPrices ? listEstimatesAdmin(actor) : Promise.resolve([]),
  ]);

  const categories = tree.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameHi: c.nameHi,
    brands: c.brands.map((b) => ({ id: b.id, name: b.name, active: b.active, models: b.models.map((m) => ({ id: m.id, name: m.name, active: m.active, releaseYear: m.releaseYear, popular: m.popular, frame: m.frame, aliases: m.aliases })) })),
    issues: c.issues.map((i) => ({ id: i.id, nameEn: i.nameEn, nameHi: i.nameHi, descriptionEn: i.descriptionEn, descriptionHi: i.descriptionHi, active: i.active })),
  }));
  const modelOptions = tree.flatMap((c) => c.brands.flatMap((b) => b.models.map((m) => ({ id: m.id, label: `${b.name} ${m.name}` }))));
  const issueOptions = tree.flatMap((c) => c.issues.map((i) => ({ id: i.id, label: `${i.nameEn} (${c.nameEn})` })));

  return (
    <>
      <PageHeader title="Devices & pricing" description="Device catalogue used by the booking flow, public repair estimates, and predefined price items for the quote builder." />
      <div className="space-y-8">
        {canCatalog && <DeviceCatalogEditor categories={categories} />}
        {canPrices && (
          <EstimatesEditor
            items={estimates.map((e) => ({
              id: e.id,
              issueTypeId: e.issueTypeId,
              modelId: e.modelId,
              minPaise: e.minPaise,
              maxPaise: e.maxPaise,
              active: e.active,
              issueName: `${e.issueType.nameEn} (${e.issueType.category.nameEn})`,
              modelName: e.model ? `${e.model.brand.name} ${e.model.name}` : null,
            }))}
            modelOptions={modelOptions}
            issueOptions={issueOptions}
          />
        )}
        {canPrices && (
          <PriceItemsEditor
            items={priceItems.map((p) => ({
              id: p.id,
              kind: p.kind,
              name: p.name,
              unitPaise: p.unitPaise,
              partGrade: p.partGrade,
              modelId: p.modelId,
              issueTypeId: p.issueTypeId,
              active: p.active,
              modelName: p.model?.name ?? null,
              issueName: p.issueType?.nameEn ?? null,
            }))}
            modelOptions={modelOptions}
            issueOptions={issueOptions}
          />
        )}
      </div>
    </>
  );
}
