import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listAudit } from "@/server/modules/team/team.service";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";

import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Audit history" };
export const instant = false;

const ENTITY_TYPES = ["RepairBooking", "RepairJob", "BusinessSetting", "ServiceableArea", "AppointmentSlot", "DiagnosisFeeRule", "WarrantyPolicy", "User", "DeviceBrand", "DeviceModel", "RepairIssueType", "PriceItem"];

const entityHref = (type: string, id: string) =>
  type === "RepairJob" ? `/admin/jobs/${id}` : type === "RepairBooking" ? `/admin/bookings/${id}` : null;

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const actor = await requireStaffPage();
  if (!can(actor, "audit.view_all") && !can(actor, "audit.view_limited")) return <NoAccess />;
  const sp = await searchParams;
  const entityType = strParam(sp.entityType);
  const page = pageParam(sp.page);
  const { items, total, pageSize, names } = await listAudit(actor, { entityType, page });
  const limited = !actor.permissions.has("audit.view_all");

  return (
    <>
      <PageHeader title="Audit history" description={limited ? "Repair and booking changes." : "Every significant administrative change, newest first."} />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="entityType" defaultValue={entityType ?? ""} aria-label="Record type" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">
          <option value="">All record types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Filter
        </Button>
      </form>
      {items.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {items.map((a) => {
              const href = entityHref(a.entityType, a.entityId);
              return (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="font-mono text-xs">{a.action}</span> · {a.actorId ? names[a.actorId] ?? "Unknown user" : "System"}
                    </p>
                    <time className="text-xs text-muted" dateTime={a.createdAt.toISOString()}>
                      {formatDateTime(a.createdAt)}
                    </time>
                  </div>
                  <p className="text-xs text-muted">
                    {a.entityType}{" "}
                    {href ? (
                      <Link href={href} className="text-primary hover:underline">
                        {a.entityId}
                      </Link>
                    ) : (
                      a.entityId
                    )}
                    {a.ipAddress && ` · ${a.ipAddress}`}
                  </p>
                  {(a.before != null || a.after != null) && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-primary">Changes</summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {a.before != null && (
                          <pre className="overflow-x-auto rounded-md bg-surface-muted p-2 text-xs">
                            <span className="font-semibold">Before</span>
                            {"\n"}
                            {JSON.stringify(a.before, null, 2)}
                          </pre>
                        )}
                        {a.after != null && (
                          <pre className="overflow-x-auto rounded-md bg-surface-muted p-2 text-xs">
                            <span className="font-semibold">After</span>
                            {"\n"}
                            {JSON.stringify(a.after, null, 2)}
                          </pre>
                        )}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/audit" params={{ entityType }} />
    </>
  );
}
