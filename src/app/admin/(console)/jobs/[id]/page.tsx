import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { JobStatus } from "@/generated/prisma/enums";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { isDeliverableEmail } from "@/server/providers/email";
import { getJobDetail, listTechnicians } from "@/server/modules/repairs/job.service";
import { listPriceItems } from "@/server/modules/quotes/quote.service";
import { findJobRule, resumeTarget } from "@/server/modules/repairs/state-machine";
import { createT } from "@/i18n/translate";
import { formatDate, formatDateTime, formatPaise } from "@/lib/format";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState } from "@/components/ui/surface";
import { JOB_TONE } from "@/components/repair/status";
import { QuoteTable } from "@/components/repair/quote-table";
import { PriorityControl, TechnicianControl, TransitionButtons } from "@/components/admin/jobs/job-controls";
import { DiagnosisForm, InspectionForm, JobPhotoUpload, NoteForm, QualityCheckForm, RepairWorkForm } from "@/components/admin/jobs/job-forms";
import { OpenDraftButton, QuoteEditor, type DraftLine } from "@/components/admin/jobs/quote-editor";
import { HandOverButton, ScheduleReturnForm } from "@/components/admin/jobs/returns-panel";

export const instant = false;

const t = createT("en");

export async function generateMetadata({ params }: PageProps<"/admin/jobs/[id]">) {
  await params;
  return { title: "Repair job" };
}

const QUOTE_TONE = { DRAFT: "neutral", SENT: "info", APPROVED: "success", DECLINED: "danger", SUPERSEDED: "neutral", EXPIRED: "warning" } as const;
const RETURN_TONE = { PENDING: "warning", SCHEDULED: "info", HANDED_OVER: "success", CANCELLED: "neutral" } as const;
const DRAFTABLE: JobStatus[] = ["INSPECTION", "QUOTE_PREPARED", "AWAITING_DECISION", "AWAITING_CUSTOMER_RESPONSE", "IN_PROGRESS"];

const SECTIONS = [
  ["overview", "Overview"],
  ["customer", "Customer"],
  ["device", "Device & issues"],
  ["inspection", "Inspection"],
  ["diagnosis", "Diagnosis"],
  ["quote", "Quote"],
  ["repair", "Repair work"],
  ["qc", "Quality check"],
  ["return", "Return"],
  ["activity", "Activity"],
] as const;

function Section({ id, title, description, action, children }: { id: string; title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader title={title} description={description} action={action} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function PhotoGrid({ ids, label }: { ids: string[]; label: string }) {
  if (ids.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {ids.map((id, i) => (
        <a key={id} href={`/api/v1/attachments/${id}`} target="_blank" className="block aspect-square overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/v1/attachments/${id}`} alt={`${label} ${i + 1}`} loading="lazy" className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

export default async function JobDetailPage({ params }: PageProps<"/admin/jobs/[id]">) {
  const { id } = await params;
  const actor = await requireStaffPage();

  let detail;
  try {
    detail = await getJobDetail(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  const { job, history, auditTrail, names, targets, isAssigned } = detail;
  const booking = job.booking;
  const status = job.status;
  const assignedTech = job.assignments.find((a) => a.active)?.technician ?? null;
  const resumeTo = resumeTarget(status, job.previousStatus);
  const reasonRequired = targets.filter((to) => to !== resumeTo && findJobRule(status, to)?.requiresReason);

  const quoteVersions = job.quote?.versions ?? [];
  const activeId = job.quote?.activeVersion?.id ?? null;
  const draft = quoteVersions.find((v) => v.status === "DRAFT" && v.id === activeId) ?? null;
  const canManageQuote = can(actor, "quote.manage");
  const canOpenDraft = canManageQuote && !draft && DRAFTABLE.includes(status);
  const [technicians, priceItems] = await Promise.all([
    can(actor, "job.assign") ? listTechnicians() : Promise.resolve([]),
    draft && canManageQuote ? listPriceItems(job.id) : Promise.resolve([]),
  ]);

  const actorOnJob = can(actor, "job.view_all") || isAssigned;
  const canInspect = can(actor, "job.inspect") && actorOnJob && (status === "DEVICE_RECEIVED" || status === "INSPECTION");
  const canDiagnose =
    (can(actor, "job.diagnose") || can(actor, "quote.diagnosis_input") || canManageQuote) &&
    actorOnJob &&
    ["INSPECTION", "QUOTE_PREPARED", "AWAITING_DECISION", "IN_PROGRESS"].includes(status);
  const canRecordWork = (can(actor, "job.transition") || (can(actor, "job.transition_assigned") && isAssigned)) && ["APPROVED", "IN_PROGRESS", "QUALITY_CHECK"].includes(status);
  const canQc = (can(actor, "job.quality_check") || can(actor, "job.transition")) && actorOnJob && status === "QUALITY_CHECK";
  const canUploadPhotos = (can(actor, "job.inspect") || can(actor, "job.diagnose")) && actorOnJob && !["COMPLETED", "CANCELLED"].includes(status);
  const canManageReturn = can(actor, "return.manage");
  const canHandOver = canManageReturn || (can(actor, "return.handover_assigned") && isAssigned);

  const receiptPhotos = job.attachments.filter((a) => a.purpose === "RECEIPT_PHOTO").map((a) => a.id);
  const inspectionPhotos = job.attachments.filter((a) => a.purpose === "INSPECTION_PHOTO").map((a) => a.id);
  const customerEmail = isDeliverableEmail(booking.customer.email) ? booking.customer.email : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">
              <Link href="/admin/jobs" className="hover:underline">Repair jobs</Link> / {job.reference}
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {booking.model.brand.name} {booking.model.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={JOB_TONE[status]}>{t(`status.job.${status}`)}</Badge>
              {status === "ON_HOLD" && job.previousStatus && <span className="text-xs text-muted">was {t(`status.job.${job.previousStatus}`)}</span>}
              <span className="text-xs text-muted">{t(`handover.${booking.handoverMethod}.title`)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {can(actor, "job.transition") ? <PriorityControl jobId={job.id} value={job.priority} /> : <Badge>{job.priority.toLowerCase()} priority</Badge>}
            {can(actor, "job.assign") ? (
              <TechnicianControl key={assignedTech?.id ?? "none"} jobId={job.id} value={assignedTech?.id ?? null} technicians={technicians} />
            ) : (
              <p className="text-sm">
                <span className="block text-xs text-muted">Technician</span>
                {assignedTech?.name ?? "Unassigned"}
              </p>
            )}
          </div>
        </div>
        {targets.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <TransitionButtons jobId={job.id} targets={targets} reasonRequired={reasonRequired} resumeTo={resumeTo} />
          </div>
        )}
      </div>

      <nav aria-label="Job sections" className="sticky top-14 z-10 -mx-4 overflow-x-auto border-b border-border bg-background/95 px-4 backdrop-blur lg:top-0 sm:-mx-6 sm:px-6">
        <ul className="flex gap-1 py-2 text-sm">
          {SECTIONS.map(([anchor, label]) => (
            <li key={anchor}>
              <a href={`#${anchor}`} className="block whitespace-nowrap rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-muted hover:text-foreground">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="overview" title="Overview">
        <DescriptionList
          items={[
            ["Booking", `${booking.reference} · booked ${formatDateTime(booking.createdAt)}`],
            ["Appointment", booking.slot ? `${formatDate(booking.slot.date)}, ${booking.slot.startTime}–${booking.slot.endTime}` : null],
            ["Device received", job.receivedAt ? formatDateTime(job.receivedAt) : "Not yet"],
            ["Diagnosis fee", `${formatPaise(booking.diagnosisFeePaise)} (${booking.feeWaivedIfApproved ? "waived if approved" : "charged regardless"})`],
            ["Completed", job.completedAt ? formatDateTime(job.completedAt) : null],
          ]}
        />
      </Section>

      <Section
        id="customer"
        title="Customer"
        action={can(actor, "customer.view") ? <Link href={`/admin/customers/${booking.customer.id}`} className="text-sm text-primary hover:underline">Customer record</Link> : null}
      >
        <DescriptionList
          items={[
            ["Contact name", booking.contactName],
            ["Contact phone", <a key="p" href={`tel:${booking.contactPhone}`} className="text-primary hover:underline">{booking.contactPhone}</a>],
            ["Account", booking.customer.name],
            ...(customerEmail ? [["Email", customerEmail] as [string, string]] : []),
            [
              "Address",
              booking.handover?.addressLine1
                ? [booking.handover.addressLine1, booking.handover.addressLine2, booking.handover.landmark, booking.handover.city, booking.handover.pincode].filter(Boolean).join(", ")
                : null,
            ],
            ["Handover notes", booking.handover?.notes ?? null],
          ]}
        />
      </Section>

      <Section id="device" title="Device & reported issues">
        <DescriptionList
          items={[
            ["Category", booking.model.category.nameEn],
            ["Model", `${booking.model.brand.name} ${booking.model.name}`],
            ["Issues", booking.issues.map((i) => i.issueType.nameEn).join(", ")],
            ["Customer description", booking.description ? <span key="d" className="whitespace-pre-line">{booking.description}</span> : null],
          ]}
        />
        {booking.attachments.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Customer photos</p>
            <PhotoGrid ids={booking.attachments.map((a) => a.id)} label="Customer photo" />
          </div>
        )}
      </Section>

      <Section id="inspection" title="Receipt condition & inspection">
        <div className="space-y-5">
          {job.inspection && !canInspect && (
            <DescriptionList
              items={[
                ["Condition at receipt", <span key="c" className="whitespace-pre-line">{job.inspection.receiptCondition}</span>],
                ["Accessories", job.inspection.accessories || null],
                [
                  "Checklist",
                  Object.entries((job.inspection.checklist as Record<string, boolean> | null) ?? {})
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                    .join(", ") || null,
                ],
                ["Recorded", `${names[job.inspection.recordedById] ?? "Staff"} · ${formatDateTime(job.inspection.updatedAt)}`],
              ]}
            />
          )}
          {canInspect ? (
            <InspectionForm
              jobId={job.id}
              initial={job.inspection ? { ...job.inspection, checklist: (job.inspection.checklist as Record<string, boolean> | null) ?? null } : null}
            />
          ) : (
            !job.inspection && <p className="text-sm text-muted">Inspection is recorded once the device is received.</p>
          )}
          <div className="space-y-3">
            <PhotoGrid ids={receiptPhotos} label="Receipt photo" />
            <PhotoGrid ids={inspectionPhotos} label="Inspection photo" />
            {canUploadPhotos && <JobPhotoUpload jobId={job.id} />}
          </div>
        </div>
      </Section>

      <Section id="diagnosis" title="Diagnosis">
        {canDiagnose ? (
          <DiagnosisForm jobId={job.id} initial={job.diagnosis} />
        ) : job.diagnosis ? (
          <DescriptionList
            items={[
              ["Findings", <span key="f" className="whitespace-pre-line">{job.diagnosis.findings}</span>],
              ["Suspected cause", job.diagnosis.suspectedCause || null],
              ["Recommended repair", job.diagnosis.recommendedRepair || null],
              ["Parts required", job.diagnosis.partsRequired || null],
              ["Recorded", `${names[job.diagnosis.recordedById] ?? "Staff"} · ${formatDateTime(job.diagnosis.updatedAt)}`],
            ]}
          />
        ) : (
          <p className="text-sm text-muted">No diagnosis recorded yet.</p>
        )}
      </Section>

      <Section
        id="quote"
        title="Quote"
        description="Customers can only approve the active sent version. Revising creates a new version that needs fresh approval."
        action={canOpenDraft ? <OpenDraftButton jobId={job.id} revise={quoteVersions.length > 0} /> : null}
      >
        <div className="space-y-6">
          {draft && canManageQuote && (
            <QuoteEditor
              key={draft.id + draft.updatedAt.toISOString()}
              versionId={draft.id}
              number={draft.number}
              taxRateBps={draft.taxRateBps}
              initialMessage={draft.customerMessage ?? ""}
              hasDiagnosis={!!job.diagnosis}
              priceItems={priceItems.map((p) => ({ id: p.id, kind: p.kind, name: p.name, unitPaise: p.unitPaise, partGrade: p.partGrade }))}
              initialLines={draft.lineItems.map<DraftLine>((l) => ({
                kind: l.kind,
                description: l.description,
                quantity: l.quantity,
                unitPaise: l.unitPaise,
                taxable: l.taxable,
                priceItemId: l.priceItemId,
                partGrade: l.partGrade,
                compatibilityNote: l.compatibilityNote,
              }))}
            />
          )}
          {draft && !canManageQuote && <Alert tone="info">A draft quote (version {draft.number}) is being prepared by staff.</Alert>}
          {quoteVersions.filter((v) => v.status !== "DRAFT").length === 0 && !draft && <EmptyState title="No quote yet" description="Record inspection and diagnosis, then prepare the quote." />}
          {quoteVersions
            .filter((v) => v.status !== "DRAFT")
            .map((v) => (
              <div key={v.id} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Version {v.number} {v.id === activeId && <span className="text-muted">(active)</span>}
                  </p>
                  <Badge tone={QUOTE_TONE[v.status]}>{v.status.toLowerCase()}</Badge>
                </div>
                <QuoteTable version={v} locale="en" t={t} />
                <p className="mt-2 text-xs text-muted">
                  {v.sentAt && `Sent ${formatDateTime(v.sentAt)}${v.sentById ? ` by ${names[v.sentById] ?? "staff"}` : ""}`}
                  {v.expiresAt && v.status === "SENT" && ` · expires ${formatDateTime(v.expiresAt)}`}
                  {v.decision && ` · ${v.decision.decision.toLowerCase()} by customer ${formatDateTime(v.decision.createdAt)}`}
                  {v.decision?.reason && ` — “${v.decision.reason}”`}
                </p>
              </div>
            ))}
        </div>
      </Section>

      <Section id="repair" title="Repair work & parts">
        {canRecordWork ? (
          <RepairWorkForm jobId={job.id} initial={{ repairNotes: job.repairNotes, partsUsed: job.partsUsed }} />
        ) : (
          <DescriptionList
            items={[
              ["Work performed", job.repairNotes ? <span key="w" className="whitespace-pre-line">{job.repairNotes}</span> : null],
              ["Parts used", job.partsUsed],
            ]}
          />
        )}
      </Section>

      <Section id="qc" title="Quality check">
        <div className="space-y-4">
          {canQc && <QualityCheckForm jobId={job.id} />}
          {job.qualityChecks.length === 0 ? (
            !canQc && <p className="text-sm text-muted">No quality checks recorded.</p>
          ) : (
            <ul className="space-y-2">
              {job.qualityChecks.map((qc) => (
                <li key={qc.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={qc.passed ? "success" : "danger"}>{qc.passed ? "Passed" : "Failed"}</Badge>
                    <span className="text-xs text-muted">
                      {names[qc.checkedById] ?? "Staff"} · {formatDateTime(qc.createdAt)}
                    </span>
                  </div>
                  {qc.notes && <p className="mt-2">{qc.notes}</p>}
                  {qc.checklist && (
                    <p className="mt-1 text-xs text-muted">
                      Checked:{" "}
                      {Object.entries(qc.checklist as Record<string, boolean>)
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                        .join(", ") || "—"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section id="return" title="Return coordination">
        <div className="space-y-4">
          {job.returns.length === 0 ? (
            <p className="text-sm text-muted">A return task is created when the device is ready to go back or the customer declines the quote.</p>
          ) : (
            job.returns.map((r) => (
              <div key={r.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {r.reason === "QUOTE_DECLINED" ? "Return unrepaired (quote declined)" : "Return after repair"} · {t(`tracking.returnMethod.${r.method}`)}
                  </p>
                  <Badge tone={RETURN_TONE[r.status]}>{r.status.replace("_", " ").toLowerCase()}</Badge>
                </div>
                <DescriptionList
                  items={[
                    ["Charge disclosed", `${formatPaise(r.chargePaise)}${r.acceptedAt ? ` · accepted ${formatDateTime(r.acceptedAt)}` : ""}`],
                    ["Address", r.method === "DELIVERY" ? [r.addressLine1, r.addressLine2, r.pincode].filter(Boolean).join(", ") || null : "Collect from shop"],
                    ["Scheduled", r.scheduledAt ? formatDateTime(r.scheduledAt) : null],
                    ["Handed over", r.handedOverAt ? `${formatDateTime(r.handedOverAt)}${r.handedOverById ? ` by ${names[r.handedOverById] ?? "staff"}` : ""}` : null],
                    ["Notes", r.notes],
                  ]}
                />
                {canManageReturn && (r.status === "PENDING" || r.status === "SCHEDULED") && (status === "RETURN_COORDINATION" || status === "READY_FOR_RETURN") && (
                  <ScheduleReturnForm returnId={r.id} initialNotes={r.notes} />
                )}
                {canHandOver && (r.status === "PENDING" || r.status === "SCHEDULED") && status === "READY_FOR_RETURN" && <HandOverButton returnId={r.id} />}
              </div>
            ))
          )}
          {job.warranty && (
            <Alert tone="success" title={`Warranty: ${job.warranty.policy.name}`}>
              {formatDate(job.warranty.startsAt)} – {formatDate(job.warranty.endsAt)}. {job.warranty.policy.termsEn}
            </Alert>
          )}
        </div>
      </Section>

      <Section id="activity" title="Activity & notes">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {can(actor, "job.note") && actorOnJob && <NoteForm jobId={job.id} />}
            {job.notes.length === 0 ? (
              <p className="text-sm text-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {job.notes.map((n) => (
                  <li key={n.id} className={`rounded-lg border p-3 text-sm ${n.visibility === "CUSTOMER" ? "border-primary/30 bg-primary-soft" : "border-border"}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        {names[n.authorId] ?? "Staff"} · {formatDateTime(n.createdAt)}
                      </span>
                      <Badge tone={n.visibility === "CUSTOMER" ? "primary" : "neutral"}>{n.visibility === "CUSTOMER" ? "Visible to customer" : "Internal"}</Badge>
                    </div>
                    <p className="whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Status history</h3>
              <ol className="space-y-2 border-l border-border pl-4">
                {history.map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                    <p>
                      <span className="font-medium">{t(`status.${h.entityType === "JOB" ? "job" : "booking"}.${h.toStatus}`)}</span>
                      {!h.customerVisible && <span className="ml-2 text-xs text-muted">(internal)</span>}
                    </p>
                    {h.reason && <p className="text-muted">{h.reason}</p>}
                    <p className="text-xs text-muted">
                      {h.actorId ? (names[h.actorId] ?? "Staff") : "System"} · {formatDateTime(h.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Audit trail ({auditTrail.length})</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {auditTrail.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-x-2 border-b border-border/60 py-1">
                    <span className="font-mono">{a.action}</span>
                    <span className="text-muted">{a.actorId ? (names[a.actorId] ?? a.actorId) : "System"}</span>
                    <span className="text-muted">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </Section>
    </div>
  );
}
