"use client";
import { useState } from "react";
import { formatDate, formatPaise, rupeesToPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import {
  generateSlotsAction,
  updateSettingsAction,
  updateSlotAction,
  upsertAreaAction,
  upsertFeeRuleAction,
  upsertWarrantyPolicyAction,
} from "@/app/admin/actions";

const rupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

// ───────── General settings ─────────

type Settings = {
  "tax.gstRateBps": number;
  "quote.expiryDays": number;
  "quote.reminderDaysBeforeExpiry": number;
  "return.collectionChargePaise": number;
  "return.deliveryChargePaise": number;
  "booking.defaultDiagnosisFeePaise": number;
  "policy.version": string;
  "warranty.defaultPolicyId": string | null;
  "business.supportPhone": string;
  "business.shopAddress": string;
  "business.whatsappNumber": string;
};

export function GeneralSettingsForm({ settings, feesOnly, policies }: { settings: Settings; feesOnly: boolean; policies: { id: string; label: string }[] }) {
  const { run, pending, error, fields, setError } = useAction();
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader title={feesOnly ? "Fees & charges" : "General settings"} />
      <CardBody>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(false);
            const f = new FormData(e.currentTarget);
            const money = (name: string) => rupeesToPaise(String(f.get(name) ?? ""));
            const changes: Record<string, unknown> = {};
            for (const [key, name] of [
              ["booking.defaultDiagnosisFeePaise", "defaultFee"],
              ["return.collectionChargePaise", "collection"],
              ["return.deliveryChargePaise", "delivery"],
            ] as const) {
              const v = money(name);
              if (v === null) return setError("Enter amounts in rupees, e.g. 199 or 99.50.");
              changes[key] = v;
            }
            const gst = Number(f.get("gst"));
            if (!Number.isFinite(gst) || gst < 0 || gst > 50) return setError("GST must be a percentage between 0 and 50.");
            changes["tax.gstRateBps"] = Math.round(gst * 100);
            if (!feesOnly) {
              changes["quote.expiryDays"] = Number(f.get("expiryDays"));
              changes["quote.reminderDaysBeforeExpiry"] = Number(f.get("reminderDays"));
              changes["policy.version"] = String(f.get("policyVersion"));
              changes["warranty.defaultPolicyId"] = String(f.get("warrantyPolicy") || "") || null;
              changes["business.supportPhone"] = String(f.get("supportPhone"));
              changes["business.shopAddress"] = String(f.get("shopAddress"));
              changes["business.whatsappNumber"] = String(f.get("whatsappNumber") ?? "").trim();
            }
            run(() => updateSettingsAction(changes), () => setSaved(true));
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Settings saved.</Alert>}
          <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="mb-2 text-sm font-semibold">Fees & tax</legend>
            <Field label="Default diagnosis fee (₹)" hint="Used when no fee rule matches." error={fields["booking.defaultDiagnosisFeePaise"]}>
              {(p) => <Input {...p} name="defaultFee" inputMode="decimal" defaultValue={rupees(settings["booking.defaultDiagnosisFeePaise"])} />}
            </Field>
            <Field label="Return — collection (₹)" hint="Charged if a declined device is collected." error={fields["return.collectionChargePaise"]}>
              {(p) => <Input {...p} name="collection" inputMode="decimal" defaultValue={rupees(settings["return.collectionChargePaise"])} />}
            </Field>
            <Field label="Return — delivery (₹)" hint="Charged if a declined device is delivered." error={fields["return.deliveryChargePaise"]}>
              {(p) => <Input {...p} name="delivery" inputMode="decimal" defaultValue={rupees(settings["return.deliveryChargePaise"])} />}
            </Field>
            <Field label="GST rate (%)" hint="Applied to taxable quote lines." error={fields["tax.gstRateBps"]}>
              {(p) => <Input {...p} name="gst" inputMode="decimal" defaultValue={String(settings["tax.gstRateBps"] / 100)} />}
            </Field>
          </fieldset>
          {!feesOnly && (
            <>
              <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <legend className="mb-2 text-sm font-semibold">Quotes & policy</legend>
                <Field label="Quote expiry (days)" error={fields["quote.expiryDays"]}>
                  {(p) => <Input {...p} name="expiryDays" type="number" min={1} max={60} defaultValue={settings["quote.expiryDays"]} />}
                </Field>
                <Field label="Reminder before expiry (days)" error={fields["quote.reminderDaysBeforeExpiry"]}>
                  {(p) => <Input {...p} name="reminderDays" type="number" min={0} max={30} defaultValue={settings["quote.reminderDaysBeforeExpiry"]} />}
                </Field>
                <Field label="Policy version" hint="Recorded with each booking's consent." error={fields["policy.version"]}>
                  {(p) => <Input {...p} name="policyVersion" defaultValue={settings["policy.version"]} />}
                </Field>
                <Field label="Default warranty policy" hint="Issued when a repaired device is handed over.">
                  {(p) => (
                    <Select {...p} name="warrantyPolicy" defaultValue={settings["warranty.defaultPolicyId"] ?? ""}>
                      <option value="">First active policy</option>
                      {policies.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </fieldset>
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold">Contact details (header Call / Chat buttons and Help page)</legend>
                <Field label="Support phone" error={fields["business.supportPhone"]}>
                  {(p) => <Input {...p} name="supportPhone" defaultValue={settings["business.supportPhone"]} />}
                </Field>
                <Field label="Shop address" error={fields["business.shopAddress"]}>
                  {(p) => <Input {...p} name="shopAddress" defaultValue={settings["business.shopAddress"]} />}
                </Field>
                <Field label="WhatsApp number (header Chat button)" hint="Leave empty to use the support phone." error={fields["business.whatsappNumber"]}>
                  {(p) => <Input {...p} name="whatsappNumber" inputMode="tel" placeholder="+91 98765 43210" defaultValue={settings["business.whatsappNumber"]} />}
                </Field>
              </fieldset>
            </>
          )}
          <Button type="submit" pending={pending}>
            Save settings
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ───────── Diagnosis fee rules ─────────

type Opt = { id: string; label: string };
type FeeRule = {
  id: string;
  categoryId: string | null;
  modelId: string | null;
  issueTypeId: string | null;
  feePaise: number;
  waivedIfApproved: boolean;
  active: boolean;
  scopeLabel: string;
};

function FeeRuleForm({ rule, scope, onDone }: { rule?: FeeRule; scope: { categories: Opt[]; models: Opt[]; issues: Opt[] }; onDone?: () => void }) {
  const { run, pending, error, setError } = useAction();
  const select = (name: string, label: string, opts: Opt[], value: string | null | undefined) => (
    <Field label={label}>
      {(p) => (
        <Select {...p} name={name} defaultValue={value ?? ""}>
          <option value="">Any</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const feePaise = rupeesToPaise(String(f.get("fee") ?? ""));
        if (feePaise === null) return setError("Enter the fee in rupees.");
        run(
          () =>
            upsertFeeRuleAction({
              id: rule?.id,
              categoryId: f.get("categoryId") || null,
              modelId: f.get("modelId") || null,
              issueTypeId: f.get("issueTypeId") || null,
              feePaise,
              waivedIfApproved: f.get("waived") === "on",
              active: rule ? f.get("active") === "on" : true,
            }),
          () => {
            if (!rule) form.reset();
            onDone?.();
          },
        );
      }}
    >
      {error && <Alert tone="danger" className="sm:col-span-2 lg:col-span-3">{error}</Alert>}
      {select("categoryId", "Device category", scope.categories, rule?.categoryId)}
      {select("modelId", "Model", scope.models, rule?.modelId)}
      {select("issueTypeId", "Issue", scope.issues, rule?.issueTypeId)}
      <Field label="Fee (₹)" required>
        {(p) => <Input {...p} name="fee" inputMode="decimal" defaultValue={rule ? rupees(rule.feePaise) : ""} />}
      </Field>
      <div className="flex flex-col justify-end gap-2 sm:col-span-1 lg:col-span-2">
        <Checkbox name="waived" label="Waived if the customer approves the repair quote" defaultChecked={rule?.waivedIfApproved ?? true} />
        {rule && <Checkbox name="active" label="Active" defaultChecked={rule.active} />}
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" pending={pending}>
          {rule ? "Save rule" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}

export function FeeRulesEditor({ rules, scope, defaultFeePaise }: { rules: FeeRule[]; scope: { categories: Opt[]; models: Opt[]; issues: Opt[] }; defaultFeePaise: number }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader
        title="Diagnosis fee rules"
        description={`For each selected issue the most specific active rule applies: model + issue › model › issue › category › default fee (${formatPaise(defaultFeePaise)}). A booking with several issues uses the highest resulting fee. The fee is shown to the customer before they book.`}
      />
      <CardBody className="space-y-4">
        {rules.length === 0 ? (
          <p className="text-sm text-muted">No rules — the default fee applies to every booking.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rules.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.scopeLabel} {!r.active && <Badge className="ml-1">Inactive</Badge>}
                    </p>
                    <p className="text-muted">{r.waivedIfApproved ? "Waived on approval" : "Always charged"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatPaise(r.feePaise)}</span>
                    <Button size="sm" variant="ghost" aria-expanded={editing === r.id} onClick={() => setEditing(editing === r.id ? null : r.id)}>
                      {editing === r.id ? "Close" : "Edit"}
                    </Button>
                  </div>
                </div>
                {editing === r.id && (
                  <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                    <FeeRuleForm rule={r} scope={scope} onDone={() => setEditing(null)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-lg border border-dashed border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">Add fee rule</summary>
          <div className="mt-3">
            <FeeRuleForm scope={scope} />
          </div>
        </details>
      </CardBody>
    </Card>
  );
}

// ───────── Serviceable areas ─────────

type Area = { id: string; pincode: string; locality: string; active: boolean };

function AreaToggle({ area }: { area: Area }) {
  const { run, pending, error } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" pending={pending} onClick={() => run(() => upsertAreaAction({ ...area, active: !area.active }))}>
        {area.active ? "Deactivate" : "Activate"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  );
}

export function AreasEditor({ areas }: { areas: Area[] }) {
  const { run, pending, error, fields } = useAction();
  return (
    <Card>
      <CardHeader title="Serviceable pincodes (Jaipur)" description="Pickup, onsite and delivery bookings are only accepted for active pincodes. Walk-in bookings skip this check." />
      <CardBody className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            run(() => upsertAreaAction({ pincode: f.get("pincode"), locality: f.get("locality"), active: true }), () => form.reset());
          }}
        >
          <Field label="Pincode" error={fields.pincode} className="w-32">
            {(p) => <Input {...p} name="pincode" inputMode="numeric" maxLength={6} />}
          </Field>
          <Field label="Locality" error={fields.locality} className="min-w-48 flex-1">
            {(p) => <Input {...p} name="locality" />}
          </Field>
          <Button type="submit" pending={pending}>
            Add / update
          </Button>
        </form>
        {error && <Alert tone="danger">{error}</Alert>}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span className={a.active ? "" : "text-muted line-through"}>
                <span className="font-medium tabular-nums">{a.pincode}</span> · {a.locality}
              </span>
              <AreaToggle area={a} />
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

// ───────── Appointment slots ─────────

type SlotRow = { id: string; date: string; startTime: string; endTime: string; capacity: number; active: boolean; confirmed: number };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SlotRowEditor({ slot }: { slot: SlotRow }) {
  const { run, pending, error } = useAction();
  const [capacity, setCapacity] = useState(String(slot.capacity));
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className={slot.active ? "" : "text-muted line-through"}>
        {slot.startTime}–{slot.endTime} · <span className="tabular-nums">{slot.confirmed}</span> confirmed
      </span>
      <span className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted">
          Capacity
          <input
            type="number"
            min={0}
            max={50}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          />
        </label>
        <Button size="sm" variant="secondary" pending={pending} disabled={Number(capacity) === slot.capacity} onClick={() => run(() => updateSlotAction(slot.id, { capacity: Number(capacity) }))}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run(() => updateSlotAction(slot.id, { active: !slot.active }))}>
          {slot.active ? "Close slot" : "Reopen"}
        </Button>
      </span>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </li>
  );
}

export function SlotsEditor({ slots }: { slots: SlotRow[] }) {
  const { run, pending, error, setError } = useAction();
  const [result, setResult] = useState<string | null>(null);
  const byDate = new Map<string, SlotRow[]>();
  for (const s of slots) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  // Today's date in IST, computed once (lazy initialiser keeps render pure).
  const [today] = useState(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10));

  return (
    <Card>
      <CardHeader title="Appointment slots" description="Next 21 days. Capacity is enforced when staff confirm bookings." />
      <CardBody className="space-y-5">
        <form
          className="grid gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setResult(null);
            const f = new FormData(e.currentTarget);
            const windows = String(f.get("windows") ?? "")
              .split(",")
              .map((w) => w.trim())
              .filter(Boolean)
              .map((w) => {
                const [start, end] = w.split("-").map((x) => x.trim());
                return { start, end };
              });
            if (!windows.length || windows.some((w) => !/^\d{2}:\d{2}$/.test(w.start ?? "") || !/^\d{2}:\d{2}$/.test(w.end ?? ""))) {
              return setError('Windows must look like "10:00-12:00, 13:00-15:00".');
            }
            run(
              () =>
                generateSlotsAction({
                  fromDate: f.get("fromDate"),
                  days: Number(f.get("days")),
                  windows,
                  capacity: Number(f.get("capacity")),
                  closedWeekdays: f.getAll("closed").map(Number),
                }),
              (data) => setResult(`${(data as { created: number }).created} slots created.`),
            );
          }}
        >
          <p className="text-sm font-semibold sm:col-span-2 lg:col-span-4">Generate slots</p>
          <Field label="From date">{(p) => <Input {...p} name="fromDate" type="date" defaultValue={today} required />}</Field>
          <Field label="Days">{(p) => <Input {...p} name="days" type="number" min={1} max={60} defaultValue={14} required />}</Field>
          <Field label="Capacity per slot">{(p) => <Input {...p} name="capacity" type="number" min={1} max={50} defaultValue={4} required />}</Field>
          <Field label="Time windows" hint="Comma-separated, 24-hour">
            {(p) => <Input {...p} name="windows" defaultValue="10:00-12:00, 13:00-15:00, 16:00-19:00" required />}
          </Field>
          <fieldset className="sm:col-span-2 lg:col-span-4">
            <legend className="mb-1 text-sm font-medium">Closed on</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((d, i) => (
                <Checkbox key={d} name="closed" value={String(i)} label={d} defaultChecked={i === 0} />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm" pending={pending}>
              Generate
            </Button>
            {result && <span className="text-sm text-success">{result}</span>}
            {error && <span className="text-sm text-danger">{error}</span>}
          </div>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">Existing slots on the same date and start time are kept unchanged.</p>
        </form>

        {byDate.size === 0 ? (
          <EmptyState title="No slots in the next 21 days" description="Customers can't book until slots exist." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[...byDate.entries()].map(([date, list]) => (
              <div key={date} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">{formatDate(date)}</p>
                <ul className="divide-y divide-border">
                  {list.map((s) => (
                    <SlotRowEditor key={s.id} slot={s} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ───────── Warranty policies ─────────

type Policy = { id: string; name: string; days: number; termsEn: string; termsHi: string | null; partGrade: string | null; active: boolean };

function WarrantyForm({ policy, onDone }: { policy?: Policy; onDone?: () => void }) {
  const { run, pending, error, fields } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        run(
          () =>
            upsertWarrantyPolicyAction({
              id: policy?.id,
              name: f.get("name"),
              days: Number(f.get("days")),
              termsEn: f.get("termsEn"),
              termsHi: f.get("termsHi"),
              partGrade: f.get("partGrade") || null,
              active: policy ? f.get("active") === "on" : true,
            }),
          () => {
            if (!policy) form.reset();
            onDone?.();
          },
        );
      }}
    >
      {error && <Alert tone="danger" className="sm:col-span-3">{error}</Alert>}
      <Field label="Name" error={fields.name} required>
        {(p) => <Input {...p} name="name" defaultValue={policy?.name} />}
      </Field>
      <Field label="Duration (days)" error={fields.days} required>
        {(p) => <Input {...p} name="days" type="number" min={0} max={730} defaultValue={policy?.days ?? 90} />}
      </Field>
      <Field label="Part grade" hint="Optional">
        {(p) => <Input {...p} name="partGrade" defaultValue={policy?.partGrade ?? ""} />}
      </Field>
      <Field label="Terms (English)" error={fields.termsEn} className="sm:col-span-3" required>
        {(p) => <Textarea {...p} name="termsEn" defaultValue={policy?.termsEn} />}
      </Field>
      <Field label="Terms (Hindi)" className="sm:col-span-3">
        {(p) => <Textarea {...p} name="termsHi" lang="hi" defaultValue={policy?.termsHi ?? ""} />}
      </Field>
      <div className="flex items-center gap-4 sm:col-span-3">
        {policy && <Checkbox name="active" label="Active" defaultChecked={policy.active} />}
        <Button type="submit" size="sm" pending={pending}>
          {policy ? "Save policy" : "Add policy"}
        </Button>
      </div>
    </form>
  );
}

export function WarrantyEditor({ policies }: { policies: Policy[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="Warranty policies" description="Placeholder terms until warranty exclusions are agreed (D-16). Shown to customers on completed repairs." />
      <CardBody className="space-y-4">
        <ul className="divide-y divide-border">
          {policies.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="font-medium">
                  {p.name} · {p.days} days {!p.active && <Badge className="ml-1">Inactive</Badge>}
                </p>
                <Button size="sm" variant="ghost" aria-expanded={editing === p.id} onClick={() => setEditing(editing === p.id ? null : p.id)}>
                  {editing === p.id ? "Close" : "Edit"}
                </Button>
              </div>
              {editing === p.id ? (
                <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                  <WarrantyForm policy={p} onDone={() => setEditing(null)} />
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted">{p.termsEn}</p>
              )}
            </li>
          ))}
        </ul>
        <details className="rounded-lg border border-dashed border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">Add warranty policy</summary>
          <div className="mt-3">
            <WarrantyForm />
          </div>
        </details>
      </CardBody>
    </Card>
  );
}
