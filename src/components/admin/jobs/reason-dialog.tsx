"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

/** Collects the reason some transitions require (hold, QC failure, closing without response). */
export function ReasonDialog({
  open,
  title,
  description,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" hint="Shown in the job history." required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={1000} autoFocus />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" pending={pending} disabled={reason.trim().length < 3}>
            Confirm
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
