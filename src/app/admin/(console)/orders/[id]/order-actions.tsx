"use client";
import { useState } from "react";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import {
  addOrderNoteAction,
  cancelOrderStaffAction,
  completeOrderAction,
  confirmOrderAction,
  declineOrderAction,
  shipOrderAction,
  startFulfilmentAction,
} from "../actions";

type Item = { id: string; name: string; quantity: number; unitPricePaise: number; onHand: number | null };
type Dlg = "confirm" | "decline" | "cancel" | "ship" | null;

/** Status actions for one order request; available buttons come from the server-side state machine. */
export function OrderActions({ requestId, targets, items }: { requestId: string; status: string; targets: string[]; items: Item[] }) {
  const { run, pending, error, fields } = useAction();
  const [dialog, setDialog] = useState<Dlg>(null);
  const [text, setText] = useState("");
  const [shipping, setShipping] = useState("0");
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  const [notice, setNotice] = useState<string | null>(null);

  if (targets.length === 0) {
    return (
      <Card>
        <CardHeader title="Actions" />
        <CardBody>
          <p className="text-sm text-muted">This request is closed. No further status changes are possible.</p>
        </CardBody>
      </Card>
    );
  }

  const close = () => {
    setDialog(null);
    setText("");
  };
  const done = (msg: string) => () => {
    setNotice(msg);
    close();
  };

  const shippingPaise = rupeesToPaise(shipping || "0");
  const confirmedTotal = items.reduce((n, i) => n + i.unitPricePaise * (qty[i.id] ?? 0), 0) + (shippingPaise ?? 0);

  return (
    <Card>
      <CardHeader title="Actions" />
      <CardBody className="space-y-3">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && !dialog && <Alert tone="danger">{error}</Alert>}
        {targets.includes("CONFIRMED") && (
          <Button block onClick={() => setDialog("confirm")}>
            Confirm availability & shipping
          </Button>
        )}
        {targets.includes("FULFILLING") && (
          <Button block pending={pending} onClick={() => run(() => startFulfilmentAction(requestId), () => setNotice("Fulfilment started. Stock has been deducted."))}>
            Start packing (deducts stock)
          </Button>
        )}
        {targets.includes("SHIPPED") && (
          <Button block onClick={() => setDialog("ship")}>
            Mark shipped
          </Button>
        )}
        {targets.includes("COMPLETED") && (
          <Button block pending={pending} onClick={() => run(() => completeOrderAction(requestId), () => setNotice("Marked as delivered."))}>
            Mark delivered
          </Button>
        )}
        {targets.includes("DECLINED") && (
          <Button block variant="secondary" onClick={() => setDialog("decline")}>
            Decline request
          </Button>
        )}
        {targets.includes("CANCELLED") && (
          <Button block variant="ghost" className="text-danger" onClick={() => setDialog("cancel")}>
            Cancel request
          </Button>
        )}
      </CardBody>

      <Dialog open={dialog === "confirm"} onClose={close} title="Confirm order" description="Set the quantities you can supply and the shipping charge. The customer is notified with the final total.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (shippingPaise === null) return;
            run(
              () => confirmOrderAction(requestId, { shippingPaise, items: items.map((i) => ({ id: i.id, confirmedQuantity: qty[i.id] ?? 0 })), message: text }),
              done("Order confirmed and customer notified."),
            );
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.name}</span>
                  <span className="text-xs text-muted">
                    Requested {i.quantity} · {formatPaise(i.unitPricePaise)} each{i.onHand !== null && ` · ${i.onHand} in stock`}
                  </span>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={i.quantity}
                  aria-label={`Confirmed quantity for ${i.name}`}
                  value={qty[i.id]}
                  onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.min(i.quantity, Number(e.target.value) || 0)) }))}
                  className="h-9 w-20"
                />
              </li>
            ))}
          </ul>
          <Field label="Shipping charge (₹)" error={shippingPaise === null ? "Enter an amount like 99 or 99.50" : fields.shippingPaise}>
            {(p) => <Input {...p} inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />}
          </Field>
          <Field label="Message to customer (optional)" hint="e.g. expected dispatch date">
            {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />}
          </Field>
          <p className="rounded-lg bg-surface-muted p-3 text-sm">
            Customer total: <strong>{formatPaise(confirmedTotal)}</strong>
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Back
            </Button>
            <Button type="submit" pending={pending}>
              Confirm order
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "decline" || dialog === "cancel"}
        onClose={close}
        title={dialog === "decline" ? "Decline request" : "Cancel request"}
        description="The customer sees this reason."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => (dialog === "decline" ? declineOrderAction(requestId, text) : cancelOrderStaffAction(requestId, text)),
              done(dialog === "decline" ? "Request declined." : "Request cancelled."),
            );
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Reason" error={fields.reason} required>
            {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Back
            </Button>
            <Button type="submit" variant="danger" pending={pending}>
              {dialog === "decline" ? "Decline" : "Cancel request"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog === "ship"} onClose={close} title="Mark as shipped" description="Share the courier and tracking number. The customer sees this on their order page.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => shipOrderAction(requestId, text), done("Marked as shipped and customer notified."));
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Courier & tracking" error={fields.trackingInfo} required>
            {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} placeholder="Blue Dart · AWB 12345678901 · track at bluedart.com" maxLength={300} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Back
            </Button>
            <Button type="submit" pending={pending}>
              Mark shipped
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

export function NoteForm({ requestId }: { requestId: string }) {
  const { run, pending, error, fields } = useAction();
  const [body, setBody] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addOrderNoteAction(requestId, body, customerVisible), () => setBody(""));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Add a note" error={fields.body}>
        {(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Call summary, stock check, delivery update…" />}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox label="Visible to customer (sends a notification)" checked={customerVisible} onChange={(e) => setCustomerVisible(e.target.checked)} />
        <Button type="submit" size="sm" variant="secondary" pending={pending}>
          Save note
        </Button>
      </div>
    </form>
  );
}
