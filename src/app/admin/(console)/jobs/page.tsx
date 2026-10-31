import Link from "next/link";
import type { HandoverMethod, JobStatus } from "@/generated/prisma/enums";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listJobs, listTechnicians, type JobFilter } from "@/server/modules/repairs/job.service";
import { createT } from "@/i18n/translate";
import { formatDateTime } from "@/lib/format";
import { HANDOVER_METHODS } from "@/lib/schemas/repair";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { JOB_TONE } from "@/components/repair/status";
import { JOB_STATUSES, JobFilters } from "@/components/admin/jobs/job-filters";

export const metadata = { title: "Repair jobs" };
export const instant = false;

const t = createT("en");

const PRIORITY_TONE = { LOW: "neutral", NORMAL: "neutral", HIGH: "warning", URGENT: "danger" } as const;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function JobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  const actor = await requireStaffPage();
  const sp = await searchParams;
  const values = {
    q: str(sp.q),
    status: str(sp.status),
    technicianId: str(sp.technicianId),
    handoverMethod: str(sp.handoverMethod),
    from: str(sp.from),
    to: str(sp.to),
  };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const filter: JobFilter = {
    q: values.q,
    status: values.status && (JOB_STATUSES as readonly string[]).includes(values.status) ? (values.status as JobStatus) : "ACTIVE",
    technicianId: values.technicianId,
    handoverMethod: values.handoverMethod && (HANDOVER_METHODS as readonly string[]).includes(values.handoverMethod) ? (values.handoverMethod as HandoverMethod) : undefined,
    from: values.from && /^\d{4}-\d{2}-\d{2}$/.test(values.from) ? values.from : undefined,
    to: values.to && /^\d{4}-\d{2}-\d{2}$/.test(values.to) ? values.to : undefined,
    page,
  };

  const [{ items, total, pageSize }, technicians] = await Promise.all([
    listJobs(actor, filter),
    can(actor, "job.view_all") ? listTechnicians() : Promise.resolve(null),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...values, page: String(p) }).filter((e): e is [string, string] => !!e[1]));
    return `/admin/jobs?${qs.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Repair jobs"
        description={`${total} job${total === 1 ? "" : "s"}${can(actor, "job.view_all") ? "" : " assigned to you"}`}
        actions={<ButtonLink href="/admin/jobs/board" variant="secondary" size="sm">Board view</ButtonLink>}
      />
      <JobFilters action="/admin/jobs" values={values} technicians={technicians} />

      {items.length === 0 ? (
        <EmptyState title="No jobs match these filters" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-border bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted text-left text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                  <th scope="col" className="px-3 py-2 font-medium">Device</th>
                  <th scope="col" className="px-3 py-2 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Priority</th>
                  <th scope="col" className="px-3 py-2 font-medium">Technician</th>
                  <th scope="col" className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((j) => (
                  <tr key={j.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
                    <td className="px-3 py-2">
                      <Link href={`/admin/jobs/${j.id}`} className="font-medium text-primary hover:underline">
                        {j.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {j.booking.model.brand.name} {j.booking.model.name}
                    </td>
                    <td className="px-3 py-2">{j.booking.contactName}</td>
                    <td className="px-3 py-2">
                      <Badge tone={JOB_TONE[j.status]}>{t(`status.job.${j.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={PRIORITY_TONE[j.priority]}>{j.priority.toLowerCase()}</Badge>
                    </td>
                    <td className="px-3 py-2">{j.assignments[0]?.technician.name ?? <span className="text-muted">Unassigned</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{formatDateTime(j.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((j) => (
              <li key={j.id}>
                <Link href={`/admin/jobs/${j.id}`} className="block rounded-[var(--radius)] border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{j.reference}</p>
                      <p className="text-sm text-muted">
                        {j.booking.model.brand.name} {j.booking.model.name} · {j.booking.contactName}
                      </p>
                    </div>
                    <Badge tone={JOB_TONE[j.status]}>{t(`status.job.${j.status}`)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {j.assignments[0]?.technician.name ?? "Unassigned"} · {j.priority.toLowerCase()} · {formatDateTime(j.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? <ButtonLink href={pageHref(page - 1)} variant="secondary" size="sm">Previous</ButtonLink> : <span />}
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              {page < pages ? <ButtonLink href={pageHref(page + 1)} variant="secondary" size="sm">Next</ButtonLink> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
