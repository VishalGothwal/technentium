import type { HandoverMethod } from "@/generated/prisma/enums";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listJobs, listTechnicians } from "@/server/modules/repairs/job.service";
import { findJobRule, manualTargets } from "@/server/modules/repairs/state-machine";
import { HANDOVER_METHODS } from "@/lib/schemas/repair";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import { JobFilters } from "@/components/admin/jobs/job-filters";
import { KanbanBoard, type BoardCard } from "@/components/admin/jobs/kanban-board";

export const metadata = { title: "Repair board" };
export const instant = false;

/** Whole days since a date (request-time helper; kept out of render for purity). */
const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function BoardPage({ searchParams }: PageProps<"/admin/jobs/board">) {
  const actor = await requireStaffPage();
  const sp = await searchParams;
  const values = { q: str(sp.q), technicianId: str(sp.technicianId), handoverMethod: str(sp.handoverMethod) };

  const [{ items, total }, technicians] = await Promise.all([
    listJobs(
      actor,
      {
        status: "ACTIVE",
        q: values.q,
        technicianId: values.technicianId,
        handoverMethod: values.handoverMethod && (HANDOVER_METHODS as readonly string[]).includes(values.handoverMethod) ? (values.handoverMethod as HandoverMethod) : undefined,
      },
      { pageSize: 300 },
    ),
    can(actor, "job.view_all") ? listTechnicians() : Promise.resolve(null),
  ]);

  const cards: BoardCard[] = items.map((j) => {
    const isAssigned = j.assignments.some((a) => a.technician.id === actor.userId);
    const targets = manualTargets(j.status, j.previousStatus, {
      hasStaffTransition: can(actor, "job.transition"),
      hasAssignedTransition: can(actor, "job.transition_assigned"),
      isAssigned,
    });
    return {
      id: j.id,
      reference: j.reference,
      status: j.status,
      device: `${j.booking.model.brand.name} ${j.booking.model.name}`,
      customer: j.booking.contactName,
      ageDays: daysSince(j.createdAt),
      priority: j.priority,
      technician: j.assignments[0]?.technician.name ?? null,
      targets,
      reasonRequired: targets.filter((to) => findJobRule(j.status, to)?.requiresReason),
    };
  });

  return (
    <>
      <PageHeader
        title="Repair board"
        description={`${total} active job${total === 1 ? "" : "s"}. Drag a card to move it, or use “Move to…” on the card.`}
        actions={<ButtonLink href="/admin/jobs" variant="secondary" size="sm">List view</ButtonLink>}
      />
      <JobFilters action="/admin/jobs/board" values={values} technicians={technicians} showStatus={false} showDates={false} />
      <KanbanBoard cards={cards} />
    </>
  );
}
