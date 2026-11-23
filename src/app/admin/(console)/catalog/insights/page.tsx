import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listDeviceInsights } from "@/server/modules/catalog/device-insights.service";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { DeviceInsights } from "@/components/admin/catalog/device-insights";

export const metadata = { title: "Device insights" };
export const instant = false;

export default async function DeviceInsightsPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "catalog.manage")) return <NoAccess />;
  const rows = await listDeviceInsights(actor);
  return (
    <>
      <PageHeader
        title="Device insights"
        description="How many devices are listed per category and brand, which are missing photos or hidden from booking, and which get booked most. Edit any device here; add brands, models and repair issues in Devices & pricing."
        actions={
          <ButtonLink href="/admin/catalog" variant="secondary">
            Devices &amp; pricing
          </ButtonLink>
        }
      />
      <DeviceInsights rows={rows} />
    </>
  );
}
