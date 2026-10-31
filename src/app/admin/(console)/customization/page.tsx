import Link from "next/link";
import type { CustomizationStatus } from "@/generated/prisma/enums";
import { requireStaffPage } from "@/server/auth/guards";
import { canAny } from "@/server/rbac/actor";
import { listCustomizationsForStaff } from "@/server/modules/customization/customization.service";
import { CUSTOMIZATION_TONE } from "@/server/modules/customization/state";
import { createT } from "@/i18n/translate";
import { formatDateTime, formatPaise } from "@/lib/format";
import { readConfig } from "@/lib/customization/config";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { Pagination } from "@/components/admin/pagination";
import { ConfigPreview } from "@/components/customization/config-preview";

export const metadata = { title: "Custom design requests" };
export const instant = false;

const t = createT("en");
const STATUSES = ["OPEN", "SUBMITTED", "UNDER_REVIEW", "NEEDS_INFO", "FEASIBILITY_CONFIRMED", "QUOTE_SHARED", "ACCEPTED", "COMPLETED", "DECLINED", "CANCELLED"] as const;

export default async function CustomizationQueuePage({ searchParams }: PageProps<"/admin/customization">) {
  const actor = await requireStaffPage();
  if (!canAny(actor, "customization.manage", "customization.technical_input")) return <NoAccess />;
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (String(sp.status) as CustomizationStatus | "OPEN") : "OPEN";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Number(sp.page) || 1;
  const { items, total, pageSize } = await listCustomizationsForStaff(actor, { status, q: q || undefined, page });

  return (
    <>
      <PageHeader title="Custom design requests" description="Review feasibility, share a price and keep the customer updated. Customers accept or decline the price themselves." />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Status</span>
          <select name="status" defaultValue={status} className="h-10 rounded-lg border border-border bg-surface px-3">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "OPEN" ? "Open (needs action)" : t(`studio.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm sm:max-w-xs">
          <span className="text-muted">Search</span>
          <input name="q" defaultValue={q} placeholder="Reference, customer, phone or device" className="h-10 rounded-lg border border-border bg-surface px-3" />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No requests match" description="Design requests from the studio appear here as soon as customers send them." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const c = readConfig(r.configuration);
            return (
              <li key={r.id}>
                <Link href={`/admin/customization/${r.id}`} className="flex gap-3 rounded-[var(--radius)] border border-border bg-surface p-3 hover:border-primary/40">
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-[#14161f] p-1.5">
                    <ConfigPreview configuration={r.configuration} label={`Preview for ${r.reference}`} className="h-full" />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-primary">{r.reference}</span>
                      <Badge tone={CUSTOMIZATION_TONE[r.status]}>{t(`studio.status.${r.status}`)}</Badge>
                    </div>
                    <p className="mt-1 truncate">
                      {r.deviceModel.brand.name} {r.deviceModel.name}
                    </p>
                    <p className="truncate text-muted">
                      {c?.design?.nameEn ?? "Blank canvas"} · {c?.finish.nameEn} · {c?.coverage.nameEn}
                    </p>
                    <p className="truncate text-muted">
                      {r.customer.name}
                      {r.customer.phoneNumber ? ` · ${r.customer.phoneNumber}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(r.createdAt)}
                      {r._count.artwork > 0 && " · artwork attached"}
                      {" · "}
                      {r.quotedPaise != null ? `Quoted ${formatPaise(r.quotedPaise)}` : r.estimatePaise != null ? `Est. ${formatPaise(r.estimatePaise)}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/customization" params={{ status, q: q || undefined }} />
    </>
  );
}
