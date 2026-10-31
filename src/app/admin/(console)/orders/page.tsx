import Link from "next/link";
import type { ProductRequestStatus } from "@/generated/prisma/enums";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listProductRequestsForStaff } from "@/server/modules/shop/request.service";
import { createT } from "@/i18n/translate";
import { formatDateTime, formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";
import { ORDER_TONE } from "@/components/shop/order-status";

export const metadata = { title: "Product requests" };
export const instant = false;

const t = createT("en");
const FILTERS = ["OPEN", "SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED", "DECLINED", "CANCELLED", "ALL"] as const;
type FilterKey = (typeof FILTERS)[number];
const LABEL: Record<FilterKey, string> = {
  OPEN: "Open",
  ALL: "All",
  SUBMITTED: "New requests",
  CONFIRMED: "Confirmed",
  FULFILLING: "Packing",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

export default async function OrderQueuePage({ searchParams }: PageProps<"/admin/orders">) {
  const actor = await requireStaffPage();
  if (!can(actor, "product_request.manage")) return <NoAccess />;
  const sp = await searchParams;
  const raw = strParam(sp.status) ?? "OPEN";
  const status: FilterKey = (FILTERS as readonly string[]).includes(raw) ? (raw as FilterKey) : "OPEN";
  const q = strParam(sp.q)?.slice(0, 60);
  const page = pageParam(sp.page);
  const { items, total, pageSize, counts } = await listProductRequestsForStaff(actor, { status: status as ProductRequestStatus | "OPEN" | "ALL", q, page });

  return (
    <>
      <PageHeader title="Product requests" description="Order requests from the protection store. Confirm availability and shipping before fulfilment — nothing is paid online." />

      <nav aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => {
          const n = f === "OPEN" ? (counts.SUBMITTED ?? 0) + (counts.CONFIRMED ?? 0) + (counts.FULFILLING ?? 0) + (counts.SHIPPED ?? 0) : f === "ALL" ? undefined : counts[f];
          return (
            <Link
              key={f}
              href={`/admin/orders?${new URLSearchParams({ status: f, ...(q ? { q } : {}) })}`}
              aria-current={status === f ? "page" : undefined}
              className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-sm", status === f ? "border-foreground bg-foreground text-white" : "border-border bg-surface hover:bg-surface-muted")}
            >
              {LABEL[f]}
              {n ? <span className="ml-1.5 opacity-70">{n}</span> : null}
            </Link>
          );
        })}
      </nav>

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={q} placeholder="Reference, name, phone or PIN code" aria-label="Search" className="h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 text-sm" />
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No requests match" description="New order requests appear here as soon as customers send them." />
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/orders/${r.id}`} className="block rounded-[var(--radius)] border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.reference}</span>
                    <Badge tone={ORDER_TONE[r.status]}>{t(`orders.status.${r.status}`)}</Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    {r.contactName} · {r.city}, {r.state}
                  </p>
                  <p className="text-xs text-muted">
                    {r._count.items} lines · {formatPaise(r.totalPaise ?? r.subtotalPaise)} · {formatDateTime(r.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted text-left text-muted">
                <tr>
                  {["Reference", "Customer", "Ship to", "Lines", "Value", "Requested", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
                    <td className="px-3 py-2">
                      <Link href={`/admin/orders/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.contactName}</td>
                    <td className="px-3 py-2">
                      {r.city}, {r.state}
                    </td>
                    <td className="px-3 py-2">{r._count.items}</td>
                    <td className="px-3 py-2">
                      {formatPaise(r.totalPaise ?? r.subtotalPaise)}
                      {r.totalPaise === null && <span className="ml-1 text-xs text-muted">+ shipping</span>}
                    </td>
                    <td className="px-3 py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={ORDER_TONE[r.status]}>{t(`orders.status.${r.status}`)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/orders" params={{ status, q }} />
        </>
      )}
    </>
  );
}
