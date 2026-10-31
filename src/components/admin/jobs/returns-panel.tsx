"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { markHandedOverAction, scheduleReturnAction } from "@/app/admin/actions";

/** Schedule a pending return (date/time in the browser's local zone, sent as ISO). */
export function ScheduleReturnForm({ returnId, initialNotes }: { returnId: string; initialNotes: string | null }) {
  const { run, pending, error, fields } = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const local = String(f.get("scheduledAt") ?? "");
        const when = new Date(local);
        run(() => scheduleReturnAction(returnId, { scheduledAt: Number.isNaN(when.getTime()) ? "" : when.toISOString(), notes: String(f.get("notes") ?? "") }));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Return date & time" error={fields.scheduledAt} required>
          {(p) => <Input {...p} type="datetime-local" name="scheduledAt" />}
        </Field>
        <Field label="Notes">
          {(p) => <Input {...p} name="notes" defaultValue={initialNotes ?? ""} placeholder="Courier, contact, collection window…" />}
        </Field>
      </div>
      <Button type="submit" size="sm" pending={pending}>
        Schedule return
      </Button>
    </form>
  );
}

/** Record the physical handover; this completes the job (and issues the warranty for repaired devices). */
export function HandOverButton({ returnId }: { returnId: string }) {
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Mark handed over
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirm handover" description="Confirm the customer has received the device. The job will be marked completed.">
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Handover notes">
            {(p) => <Textarea {...p} className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button pending={pending} onClick={() => run(() => markHandedOverAction(returnId, notes), () => setOpen(false))}>
              Confirm handover
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
