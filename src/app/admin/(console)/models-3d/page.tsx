import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listDevice3dModels } from "@/server/modules/catalog/device-3d-admin.service";
import { FRAME_FAMILIES, isFrameKey } from "@/lib/device-frames";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { BulkGlbUpload, GenerateDefaultsButton } from "./model-form";

export const metadata = { title: "3D models" };
export const instant = false;

export default async function Models3dPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "catalog.manage")) return <NoAccess />;
  const { models, coverage } = await listDevice3dModels(actor);

  return (
    <>
      <PageHeader
        title="3D models"
        description={`3D device bodies used in the studio, repair pages and previews. ${coverage.assigned} of ${coverage.total} phones, tablets and laptops have a model assigned; the rest are generated automatically from their camera layout.`}
        actions={
          <div className="flex gap-2">
            <GenerateDefaultsButton />
            <ButtonLink href="/admin/models-3d/new">New 3D model</ButtonLink>
          </div>
        }
      />
      {models.length > 0 && <BulkGlbUpload slugs={Object.fromEntries(models.map((m) => [m.slug, m.id]))} />}
      {models.length === 0 ? (
        <EmptyState title="No 3D models yet" description="“Generate for all devices” creates one model per phone, tablet and laptop with its real size and links it. You can then edit each one or upload a .glb file." />
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
          {models.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm ${m.active ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <Link href={`/admin/models-3d/${m.id}`} className="font-medium text-primary hover:underline">
                  {m.name}
                </Link>
                <p className="text-xs text-muted">
                  {m.slug} · layout: {isFrameKey(m.frame) ? FRAME_FAMILIES[m.frame].label : m.frame}
                </p>
              </div>
              <p className="flex flex-wrap gap-1">
                {m.fileId ? <Badge tone="primary">.glb {m.file ? `${(m.file.sizeBytes / 1048576).toFixed(1)} MB` : ""}</Badge> : <Badge>Generated</Badge>}
                <Badge tone="info">{m._count.devices} {m._count.devices === 1 ? "device" : "devices"}</Badge>
                {!m.active && <Badge>Inactive</Badge>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
