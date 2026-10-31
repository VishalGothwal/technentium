"use client";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import {
  cancelBookingStaffAction,
  confirmBookingAction,
  declineBookingAction,
  requestInfoAction,
  rescheduleBookingAction,
} from "../../../actions";

type Slot = { id: string; date: string; startTime: string; endTime: string; remaining: number };

type ReasonKind = "decline" | "info" | "cancel" | "reschedule";

const REASON_COPY: Record<ReasonKind, { title: string; description: string; confirm: string; danger?: boolean }> = {
  decline: { title: "Decline booking", description: "The customer sees this reason.", confirm: "Decline booking", danger: true },
  info: { title: "Request more information", description: "Ask a clear question. The customer replies from their booking page.", confirm: "Send request" },
  cancel: { title: "Cancel booking", description: "Only possible before the device is handed over. The customer is notified.", confirm: "Cancel booking", danger: true },
  reschedule: { title: "Reschedule appointment", description: "The customer is notified of the new slot and the reason.", confirm: "Reschedule" },
};

export function BookingActions(props: {
  bookingId: string;
  status: string;
  open: boolean;
  reschedulable: boolean;
  canConfirm: boolean;
  canDecline: boolean;
  canRequestInfo: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  technicians: { id: string; name: string }[];
  slots: Slot[];
}) {
  const { run, pending, error, fields } = useAction();
  const [technicianId, setTechnicianId] = useState("");
  const [dialog, setDialog] = useState<ReasonKind | null>(null);
  const [reason, setReason] = useState("");
  const [slotId, setSlotId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const close = () => {
    setDialog(null);
    setReason("");
  };

  const submitReason = () => {
    const done = () => {
      setNotice(`${REASON_COPY[dialog!].title}: done.`);
      close();
    };
    if (dialog === "decline") run(() => declineBookingAction(props.bookingId, reason), done);
    if (dialog === "info") run(() => requestInfoAction(props.bookingId, reason), done);
    if (dialog === "cancel") run(() => cancelBookingStaffAction(props.bookingId, reason), done);
    if (dialog === "reschedule") run(() => rescheduleBookingAction(props.bookingId, slotId, reason), done);
  };

  const anyAction = (props.open && (props.canConfirm || props.canDecline || props.canRequestInfo)) || (props.reschedulable && props.canReschedule) || props.canCancel;
  if (!anyAction) return null;

  return (
    <Card>
      <CardHeader title="Actions" />
      <CardBody className="space-y-4">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && !dialog && <Alert tone="danger">{error}</Alert>}

        {props.status === "SUBMITTED" && props.canConfirm && (
          <div className="space-y-2">
            {props.technicians.length > 0 && (
              <Field label="Assign technician (optional)">
                {(p) => (
                  <Select {...p} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                    <option value="">Assign later</option>
                    {props.technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Button block pending={pending && !dialog} onClick={() => run(() => confirmBookingAction(props.bookingId, technicianId || null), () => setNotice("Booking confirmed and repair job created."))}>
              Confirm booking
            </Button>
            <p className="text-xs text-muted">Checks slot capacity and notifies the customer.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {props.status === "SUBMITTED" && props.canRequestInfo && (
            <Button variant="secondary" onClick={() => setDialog("info")}>
              Request information
            </Button>
          )}
          {props.reschedulable && props.canReschedule && (
            <Button variant="secondary" onClick={() => setDialog("reschedule")}>
              Reschedule
            </Button>
          )}
          {props.open && props.canDecline && (
            <Button variant="secondary" onClick={() => setDialog("decline")}>
              Decline
            </Button>
          )}
          {props.canCancel && (
            <Button variant="ghost" onClick={() => setDialog("cancel")}>
              Cancel booking
            </Button>
          )}
        </div>

        {dialog && (
          <Dialog open onClose={close} title={REASON_COPY[dialog].title} description={REASON_COPY[dialog].description}>
            <div className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              {dialog === "reschedule" && (
                <Field label="New slot" error={fields.slotId} required>
                  {(p) => (
                    <Select {...p} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                      <option value="">Choose a slot</option>
                      {props.slots.map((s) => (
                        <option key={s.id} value={s.id} disabled={s.remaining <= 0}>
                          {formatDate(s.date)} {s.startTime}–{s.endTime} ({s.remaining} left)
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <Field label={dialog === "info" ? "Question for the customer" : "Reason"} error={fields.reason} required>
                {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  Back
                </Button>
                <Button variant={REASON_COPY[dialog].danger ? "danger" : "primary"} pending={pending} onClick={submitReason}>
                  {REASON_COPY[dialog].confirm}
                </Button>
              </div>
            </div>
          </Dialog>
        )}
      </CardBody>
    </Card>
  );
}
