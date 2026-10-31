import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import {
  listAreas,
  listFeeRules,
  listSlots,
  listWarrantyPolicies,
  readSettings,
} from "@/server/modules/settings/admin-settings.service";
import { catalogTree } from "@/server/modules/catalog/catalog-admin.service";
import { PageHeader } from "@/components/ui/surface";
import { AreasEditor, FeeRulesEditor, GeneralSettingsForm, SlotsEditor, WarrantyEditor } from "@/components/admin/settings/editors";

import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Settings" };
export const instant = false;

export default async function SettingsPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "settings.manage") && !can(actor, "settings.fees")) return <NoAccess />;
  const full = can(actor, "settings.manage");
  const [settings, feeRules, tree, areas, slots, policies] = await Promise.all([
    readSettings(actor),
    listFeeRules(actor),
    catalogTree(actor),
    full ? listAreas(actor) : Promise.resolve([]),
    full ? listSlots(actor, 21) : Promise.resolve([]),
    full ? listWarrantyPolicies(actor) : Promise.resolve([]),
  ]);

  const scope = {
    categories: tree.map((c) => ({ id: c.id, label: c.nameEn })),
    models: tree.flatMap((c) => c.brands.flatMap((b) => b.models.map((m) => ({ id: m.id, label: `${b.name} ${m.name}` })))),
    issues: tree.flatMap((c) => c.issues.map((i) => ({ id: i.id, label: `${i.nameEn} (${c.nameEn})` }))),
  };

  return (
    <>
      <PageHeader title="Settings" description="Business rules used by bookings, quotes and returns. Changes are recorded in the audit history." />
      <div className="space-y-6">
        <GeneralSettingsForm
          settings={settings}
          feesOnly={!full}
          policies={policies.map((p) => ({ id: p.id, label: `${p.name} (${p.days} days)` }))}
        />
        <FeeRulesEditor
          rules={feeRules.map((r) => ({
            id: r.id,
            categoryId: r.categoryId,
            modelId: r.modelId,
            issueTypeId: r.issueTypeId,
            feePaise: r.feePaise,
            waivedIfApproved: r.waivedIfApproved,
            active: r.active,
            scopeLabel: [r.category?.nameEn, r.model?.name, r.issueType?.nameEn].filter(Boolean).join(" · ") || "All devices",
          }))}
          scope={scope}
          defaultFeePaise={settings["booking.defaultDiagnosisFeePaise"]}
        />
        {full && (
          <>
            <AreasEditor areas={areas.map((a) => ({ id: a.id, pincode: a.pincode, locality: a.locality, active: a.active }))} />
            <SlotsEditor
              slots={slots.map((s) => ({
                id: s.id,
                date: s.date.toISOString().slice(0, 10),
                startTime: s.startTime,
                endTime: s.endTime,
                capacity: s.capacity,
                active: s.active,
                confirmed: s._count.bookings,
              }))}
            />
            <WarrantyEditor
              policies={policies.map((p) => ({ id: p.id, name: p.name, days: p.days, termsEn: p.termsEn, termsHi: p.termsHi, partGrade: p.partGrade, active: p.active }))}
            />
          </>
        )}
      </div>
    </>
  );
}
