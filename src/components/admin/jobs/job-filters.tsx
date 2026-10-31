import { HANDOVER_METHODS } from "@/lib/schemas/repair";
import { createT } from "@/i18n/translate";
import { ButtonLink } from "@/components/ui/button";

const t = createT("en");

export const JOB_STATUSES = [
  "AWAITING_HANDOVER",
  "DEVICE_RECEIVED",
  "INSPECTION",
  "QUOTE_PREPARED",
  "AWAITING_DECISION",
  "APPROVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_RETURN",
  "ON_HOLD",
  "AWAITING_CUSTOMER_RESPONSE",
  "QUOTE_DECLINED",
  "RETURN_COORDINATION",
  "COMPLETED",
  "CANCELLED",
] as const;

const control = "h-10 rounded-lg border border-border bg-surface px-2 text-sm";

/** GET form: filters live in the URL so lists are shareable and survive refresh. */
export function JobFilters({
  action,
  values,
  technicians,
  showStatus = true,
  showDates = true,
}: {
  action: string;
  values: Record<string, string | undefined>;
  technicians: { id: string; name: string }[] | null;
  showStatus?: boolean;
  showDates?: boolean;
}) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-border bg-surface p-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Search
        <input name="q" defaultValue={values.q ?? ""} placeholder="Reference or name" className={`${control} w-44`} />
      </label>
      {showStatus && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={values.status ?? "ACTIVE"} className={control}>
            <option value="ACTIVE">All active</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.job.${s}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {technicians && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Technician
          <select name="technicianId" defaultValue={values.technicianId ?? ""} className={control}>
            <option value="">Any</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Handover
        <select name="handoverMethod" defaultValue={values.handoverMethod ?? ""} className={control}>
          <option value="">Any</option>
          {HANDOVER_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`handover.${m}.title`)}
            </option>
          ))}
        </select>
      </label>
      {showDates && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">
            From
            <input type="date" name="from" defaultValue={values.from ?? ""} className={control} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            To
            <input type="date" name="to" defaultValue={values.to ?? ""} className={control} />
          </label>
        </>
      )}
      <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
        Apply
      </button>
      <ButtonLink href={action} variant="ghost" size="sm" className="h-10">
        Reset
      </ButtonLink>
    </form>
  );
}
