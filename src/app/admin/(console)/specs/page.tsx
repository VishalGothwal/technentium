import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listSpecsAdmin, modelsWithoutSpecs } from "@/server/modules/content/specs.admin";
import { deviceName } from "@/lib/content/specs";
import { formatDate } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { strParam } from "@/components/admin/pagination";

export const metadata = { title: "Specs & comparisons" };
export const instant = false;

const STATUS_TONE = { DRAFT: "neutral", SCHEDULED: "info", PUBLISHED: "success", ARCHIVED: "warning" } as const;

export default async function SpecsAdminPage({ searchParams }: PageProps<"/admin/specs">) {
  const actor = await requireStaffPage();
  if (!can(actor, "content.edit")) return <NoAccess />;
  const q = strParam((await searchParams).q)?.slice(0, 80);
  const [{ specs, comparisons }, models] = await Promise.all([listSpecsAdmin(actor, q), modelsWithoutSpecs(actor)]);

  return (
    <>
      <PageHeader title="Specs & comparisons" description="Structured phone specifications and curated comparisons. Unknown values are shown publicly as “Not available”." actions={<ButtonLink href="/admin/specs/comparisons/new">New comparison</ButtonLink>} />

      <Card className="mb-6 p-4">
        <form action="/admin/specs/new" className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">
            Add a spec sheet for
            <select name="model" required className="h-10 rounded-lg border border-border bg-surface px-2 text-sm font-normal">
              <option value="">Choose a device…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {deviceName(m.brand.name, m.name)} ({m.category.nameEn})
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" className="h-10">
            Start from template
          </Button>
        </form>
      </Card>

      <section aria-labelledby="specs-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="specs-title" className="text-lg font-semibold">
            Spec sheets ({specs.length})
          </h2>
          <form role="search" className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search device" aria-label="Search spec sheets" className="h-9 rounded-lg border border-border bg-surface px-3 text-sm" />
            <Button type="submit" size="sm" variant="secondary">
              Search
            </Button>
          </form>
        </div>
        {specs.length === 0 ? (
          <EmptyState title="No spec sheets yet" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {specs.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/specs/${s.id}`} className="block rounded-xl border border-border bg-surface p-3 hover:border-primary">
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{deviceName(s.deviceModel.brand.name, s.deviceModel.name)}</span>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status.toLowerCase()}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {s.filled}/{s.totalFields} values · updated {formatDate(s.updatedAt)}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                    <div className="h-full bg-primary" style={{ width: `${s.totalFields ? Math.round((s.filled / s.totalFields) * 100) : 0}%` }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="cmp-title">
        <h2 id="cmp-title" className="mb-3 text-lg font-semibold">
          Comparisons ({comparisons.length})
        </h2>
        {comparisons.length === 0 ? (
          <EmptyState title="No comparisons yet" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {comparisons.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/specs/comparisons/${c.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-muted">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.titleEn}</span>
                    <span className="text-xs text-muted">
                      {c._count.devices} devices · /{c.slug}
                    </span>
                  </span>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status.toLowerCase()}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
