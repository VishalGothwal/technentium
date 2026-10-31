"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import {
  addJobNoteAction,
  recordDiagnosisAction,
  recordInspectionAction,
  recordQualityCheckAction,
  recordRepairWorkAction,
} from "@/app/admin/actions";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

function Saved({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="text-sm text-success">
      Saved
    </span>
  ) : null;
}

const RECEIPT_CHECKS = [
  ["powersOn", "Powers on"],
  ["screenCracked", "Screen cracked"],
  ["bodyDamage", "Body dents / scratches"],
  ["liquidIndicator", "Liquid indicator tripped"],
  ["simRemoved", "SIM / memory card removed"],
] as const;

export function InspectionForm({ jobId, initial }: { jobId: string; initial: { receiptCondition: string; accessories: string | null; checklist: Record<string, boolean> | null } | null }) {
  const { run, pending, error, fields } = useAction();
  const [saved, setSaved] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initial?.checklist ?? {});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSaved(false);
        run(() => recordInspectionAction(jobId, { receiptCondition: f.get("receiptCondition"), accessories: f.get("accessories"), checklist }), () => setSaved(true));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Condition at receipt" hint="Visible damage, marks, what powers on — before any work." error={fields.receiptCondition} required>
        {(p) => <Textarea {...p} name="receiptCondition" defaultValue={initial?.receiptCondition ?? ""} />}
      </Field>
      <Field label="Accessories received" error={fields.accessories}>
        {(p) => <Input {...p} name="accessories" defaultValue={initial?.accessories ?? ""} placeholder="Case, charger, SIM tray…" />}
      </Field>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Receipt checklist</legend>
        {RECEIPT_CHECKS.map(([key, label]) => (
          <Checkbox key={key} label={label} checked={!!checklist[key]} onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })} />
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending}>
          Save inspection
        </Button>
        <Saved show={saved} />
      </div>
    </form>
  );
}

export function DiagnosisForm({
  jobId,
  initial,
}: {
  jobId: string;
  initial: { findings: string; suspectedCause: string | null; recommendedRepair: string | null; partsRequired: string | null } | null;
}) {
  const { run, pending, error, fields } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSaved(false);
        run(
          () =>
            recordDiagnosisAction(jobId, {
              findings: f.get("findings"),
              suspectedCause: f.get("suspectedCause"),
              recommendedRepair: f.get("recommendedRepair"),
              partsRequired: f.get("partsRequired"),
            }),
          () => setSaved(true),
        );
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Findings" error={fields.findings} required>
        {(p) => <Textarea {...p} name="findings" defaultValue={initial?.findings ?? ""} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Suspected cause">
          {(p) => <Textarea {...p} name="suspectedCause" className="min-h-16" defaultValue={initial?.suspectedCause ?? ""} />}
        </Field>
        <Field label="Recommended repair">
          {(p) => <Textarea {...p} name="recommendedRepair" className="min-h-16" defaultValue={initial?.recommendedRepair ?? ""} />}
        </Field>
      </div>
      <Field label="Parts required">
        {(p) => <Input {...p} name="partsRequired" defaultValue={initial?.partsRequired ?? ""} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending}>
          Save diagnosis
        </Button>
        <Saved show={saved} />
      </div>
    </form>
  );
}

export function RepairWorkForm({ jobId, initial }: { jobId: string; initial: { repairNotes: string | null; partsUsed: string | null } }) {
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSaved(false);
        run(() => recordRepairWorkAction(jobId, { repairNotes: String(f.get("repairNotes") ?? ""), partsUsed: String(f.get("partsUsed") ?? "") }), () => setSaved(true));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Work performed">
        {(p) => <Textarea {...p} name="repairNotes" defaultValue={initial.repairNotes ?? ""} />}
      </Field>
      <Field label="Parts used" hint="Part, grade and quantity.">
        {(p) => <Input {...p} name="partsUsed" defaultValue={initial.partsUsed ?? ""} />}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending}>
          Save work record
        </Button>
        <Saved show={saved} />
      </div>
    </form>
  );
}

const QC_CHECKS = [
  ["display", "Display & touch"],
  ["charging", "Charging"],
  ["audio", "Speaker & microphone"],
  ["cameras", "Cameras"],
  ["connectivity", "Wi-Fi / mobile network"],
  ["buttons", "Buttons & sensors"],
] as const;

export function QualityCheckForm({ jobId }: { jobId: string }) {
  const { run, pending, error } = useAction();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [passed, setPassed] = useState<"yes" | "no">("yes");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const notes = String(new FormData(e.currentTarget).get("notes") ?? "");
        run(() => recordQualityCheckAction(jobId, { passed: passed === "yes", notes, checklist }));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Checks</legend>
        {QC_CHECKS.map(([key, label]) => (
          <Checkbox key={key} label={label} checked={!!checklist[key]} onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })} />
        ))}
      </fieldset>
      <Field label="Result" required>
        {(p) => (
          <Select {...p} value={passed} onChange={(e) => setPassed(e.target.value as "yes" | "no")} className="max-w-48">
            <option value="yes">Passed</option>
            <option value="no">Failed</option>
          </Select>
        )}
      </Field>
      <Field label="Notes">
        {(p) => <Textarea {...p} name="notes" className="min-h-16" />}
      </Field>
      <Button type="submit" pending={pending}>
        Record quality check
      </Button>
    </form>
  );
}

export function NoteForm({ jobId }: { jobId: string }) {
  const { run, pending, error, fields } = useAction();
  const [body, setBody] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addJobNoteAction(jobId, { body, visibility: customerVisible ? "CUSTOMER" : "INTERNAL" }), () => {
          setBody("");
          setCustomerVisible(false);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Add a note" error={fields.body}>
        {(p) => <Textarea {...p} className="min-h-16" value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <Checkbox
        checked={customerVisible}
        onChange={(e) => setCustomerVisible(e.target.checked)}
        label={
          <>
            <strong>Visible to customer</strong> — shown on their booking page. Leave unticked for internal notes.
          </>
        }
      />
      <Button type="submit" size="sm" pending={pending} disabled={!body.trim()} variant={customerVisible ? "primary" : "secondary"}>
        {customerVisible ? "Post message to customer" : "Add internal note"}
      </Button>
    </form>
  );
}

/** Upload receipt/inspection photos through the authorised admin upload route. */
export function JobPhotoUpload({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<"RECEIPT_PHOTO" | "INSPECTION_PHOTO">("RECEIPT_PHOTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Photo type
        <select className="h-9 rounded-md border border-border bg-surface px-2 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}>
          <option value="RECEIPT_PHOTO">Receipt condition</option>
          <option value="INSPECTION_PHOTO">Inspection</option>
        </select>
      </label>
      <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-dashed border-border px-3 text-sm hover:bg-surface-muted">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            setBusy(true);
            setError(null);
            try {
              for (const file of files) {
                const form = new FormData();
                form.append("file", file);
                form.append("purpose", purpose);
                await apiFetch(`/api/v1/admin/jobs/${jobId}/photos`, { method: "POST", body: form });
              }
              router.refresh();
            } catch (err) {
              setError(err instanceof ApiRequestError ? err.error.message : "Upload failed");
            } finally {
              setBusy(false);
            }
          }}
        />
        {busy ? "Uploading…" : "Upload photos"}
      </label>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
