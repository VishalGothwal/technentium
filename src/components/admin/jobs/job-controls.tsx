"use client";
import { useState } from "react";
import type { JobStatus } from "@/generated/prisma/enums";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { assignTechnicianAction, setPriorityAction, transitionJobAction } from "@/app/admin/actions";
import { ReasonDialog } from "./reason-dialog";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const control = "h-9 rounded-md border border-border bg-surface px-2 text-sm";

export function PriorityControl({ jobId, value }: { jobId: string; value: (typeof PRIORITIES)[number] }) {
  const { run, pending, error } = useAction();
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      Priority
      <select className={control} defaultValue={value} disabled={pending} onChange={(e) => run(() => setPriorityAction(jobId, e.target.value as (typeof PRIORITIES)[number]))}>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p.charAt(0) + p.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      {error && <span className="text-danger">{error}</span>}
    </label>
  );
}

export function TechnicianControl({ jobId, value, technicians }: { jobId: string; value: string | null; technicians: { id: string; name: string }[] }) {
  const { run, pending, error } = useAction();
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      Technician
      <select
        className={control}
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => e.target.value && run(() => assignTechnicianAction(jobId, e.target.value))}
      >
        <option value="" disabled>
          Unassigned
        </option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {error && <span className="text-danger">{error}</span>}
    </label>
  );
}

/** One button per status change this actor may make right now (computed server-side from the state machine). */
export function TransitionButtons({ jobId, targets, reasonRequired, resumeTo }: { jobId: string; targets: JobStatus[]; reasonRequired: JobStatus[]; resumeTo: JobStatus | null }) {
  const { t } = useI18n();
  const { run, pending, error } = useAction();
  const [ask, setAsk] = useState<JobStatus | null>(null);

  if (targets.length === 0) return null;

  const labelFor = (to: JobStatus) => (to === resumeTo ? `Resume: ${t(`status.job.${to}`)}` : to === "ON_HOLD" ? "Put on hold" : `Move to ${t(`status.job.${to}`)}`);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {targets.map((to) => (
          <Button
            key={to}
            size="sm"
            variant={to === "ON_HOLD" ? "secondary" : "primary"}
            pending={pending && ask === null}
            onClick={() => (reasonRequired.includes(to) ? setAsk(to) : run(() => transitionJobAction(jobId, to)))}
          >
            {labelFor(to)}
          </Button>
        ))}
      </div>
      {error && !ask && <Alert tone="danger">{error}</Alert>}
      <ReasonDialog
        key={ask ?? "none"}
        open={!!ask}
        title={ask ? labelFor(ask) : ""}
        pending={pending}
        error={ask ? error : null}
        onCancel={() => setAsk(null)}
        onConfirm={(reason) => ask && run(() => transitionJobAction(jobId, ask, reason), () => setAsk(null))}
      />
    </div>
  );
}
