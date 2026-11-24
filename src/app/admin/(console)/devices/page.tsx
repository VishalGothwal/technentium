import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listCatalogOptions, listDeviceInsights } from "@/server/modules/catalog/device-insights.service";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { DeviceInsights } from "@/components/admin/catalog/device-insights";

export const metadata = { title: "Devices" };
export const instant = false;

export default async function DevicesHubPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "catalog.manage")) return <NoAccess />;
  const [rows, categories] = await Promise.all([listDeviceInsights(actor), listCatalogOptions(actor)]);
  return (
    <>
      <PageHeader
        title="Devices"
        description="One place for every device on the site: its photo, repair prices, spec sheet, 3D model and the protection products that fit it. Open a device to manage everything attached to it."
        actions={
          <ButtonLink href="/admin/catalog" variant="secondary">
            Repair issues &amp; pricing
          </ButtonLink>
        }
      />
      <DeviceInsights rows={rows} categories={categories} />
    </>
  );
}
