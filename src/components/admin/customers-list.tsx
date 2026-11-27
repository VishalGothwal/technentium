import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listCustomers, type CustomerSection } from "@/server/modules/customers/customer.service";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";

type Counts = { bookings: number; productRequests: number; customizationRequests: number };
const COLUMNS: { key: keyof Counts; label: string; section: CustomerSection }[] = [
  { key: "bookings", label: "Bookings", section: "repairs" },
  { key: "productRequests", label: "Orders", section: "protection" },
  { key: "customizationRequests", label: "Designs", section: "customization" },
];

/** Customer list for All customers and for each section's Customers tab (people with activity in that section). */
export async function CustomersList({
  searchParams,
  basePath,
  title,
  description,
  section,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath: string;
  title: string;
  description: string;
  section?: CustomerSection;
}) {
  const actor = await requireStaffPage();
  if (!can(actor, "customer.view")) return <NoAccess />;
  const sp = await searchParams;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { items, total, pageSize } = await listCustomers(actor, { q, page, section });
  const columns = section ? COLUMNS.filter((c) => c.section === section) : COLUMNS;

  return (
    <>
      <PageHeader title={title} description={description} />
      <form className="mb-4 flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email or phone"
          aria-label="Search customers"
          className="h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Search
        </Button>
      </form>
      {items.length === 0 ? (
        <EmptyState title="No customers found" />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="block rounded-lg border border-border bg-surface p-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted">{[c.phoneNumber, c.email].filter(Boolean).join(" · ") || "-"}</p>
                  <p className="text-xs text-muted">
                    {columns.map((col) => `${c._count[col.key]} ${col.label.toLowerCase()}`).join(" · ")} · joined {formatDate(c.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-2 text-right font-medium">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{c.phoneNumber ?? "-"}</td>
                    <td className="px-4 py-2">{c.email ?? "-"}</td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-2 text-right tabular-nums">
                        {c._count[col.key]}
                      </td>
                    ))}
                    <td className="px-4 py-2">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} pageSize={pageSize} total={total} basePath={basePath} params={{ q }} />
        </>
      )}
    </>
  );
}
