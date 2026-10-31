"use client";
import { useState } from "react";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { importModelsCsvAction, upsertBrandAction, upsertEstimateAction, upsertIssueAction, upsertModelAction, upsertPriceItemAction } from "@/app/admin/actions";
import { FRAME_FAMILIES, FRAME_KEYS } from "@/lib/device-frames";

type Model = { id: string; name: string; active: boolean; releaseYear: number | null; popular: boolean; frame: string | null; aliases: string[] };
type Brand = { id: string; name: string; active: boolean; models: Model[] };
type Issue = { id: string; nameEn: string; nameHi: string | null; descriptionEn: string | null; descriptionHi: string | null; active: boolean };
type Category = { id: string; nameEn: string; nameHi: string | null; brands: Brand[]; issues: Issue[] };

const inactive = (active: boolean) => (active ? null : <Badge className="ml-2">Inactive</Badge>);

/** Small inline name + active editor used for brands and models. */
function NameForm({
  initial,
  submitLabel,
  onSubmit,
  onDone,
}: {
  initial?: { name: string; active: boolean };
  submitLabel: string;
  onSubmit: (v: { name: string; active: boolean }) => Promise<{ ok: true; data: unknown } | { ok: false; messageKey: string; fields?: Record<string, string> }>;
  onDone?: () => void;
}) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState(initial?.name ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => onSubmit({ name, active }), () => {
          if (!initial) setName("");
          onDone?.();
        });
      }}
    >
      <Input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-56" required />
      {initial && <Checkbox label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} className="items-center" />}
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        {submitLabel}
      </Button>
      {error && <span className="w-full text-sm text-danger">{error}</span>}
    </form>
  );
}

/** Model editor: name, launch year, frame family (2D outline), popular flag, search shorthands. */
function ModelForm({ brandId, model }: { brandId: string; model?: Model }) {
  const { run, pending, error } = useAction();
  return (
    <form
      className="grid w-full grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(9rem,1fr)_5.5rem_minmax(9rem,1fr)_minmax(7rem,1fr)_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const year = String(f.get("releaseYear") ?? "").trim();
        run(
          () =>
            upsertModelAction({
              id: model?.id,
              brandId,
              name: f.get("name"),
              active: model ? f.get("active") === "on" : true,
              releaseYear: year ? Number(year) : null,
              frame: f.get("frame") || null,
              popular: f.get("popular") === "on",
              aliases: String(f.get("aliases") ?? "")
                .split(/[;,]/)
                .map((a) => a.trim())
                .filter(Boolean),
            }),
          () => {
            if (!model) form.reset();
          },
        );
      }}
    >
      <Input aria-label="Model name" name="name" defaultValue={model?.name} className="col-span-2 h-9 sm:col-span-1" required />
      <Input aria-label="Launch year" name="releaseYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="Year" defaultValue={model?.releaseYear ?? ""} className="h-9" />
      <Select aria-label="Frame (2D outline)" name="frame" defaultValue={model?.frame ?? ""} className="h-9">
        <option value="">Default for category</option>
        {FRAME_KEYS.map((k) => (
          <option key={k} value={k}>
            {FRAME_FAMILIES[k].label}
          </option>
        ))}
      </Select>
      <Input aria-label="Search shorthands" name="aliases" placeholder="s24u; 24 ultra" defaultValue={model?.aliases.join("; ") ?? ""} className="h-9" />
      <div className="flex items-center gap-3">
        <Checkbox name="popular" label="Popular" defaultChecked={model?.popular ?? false} className="items-center" />
        {model && <Checkbox name="active" label="Active" defaultChecked={model.active} className="items-center" />}
      </div>
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        {model ? "Save" : "Add model"}
      </Button>
      {error && <span className="col-span-full text-sm text-danger">{error}</span>}
    </form>
  );
}

type ImportResult = { created: number; updated: number; brandsCreated: number; errors: { line: number; message: string }[]; applied: boolean };

/** Bulk add/update models from a CSV file: preview first, then apply. */
function ModelImport() {
  const { run, pending, error } = useAction();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const submit = (apply: boolean) => run(() => importModelsCsvAction({ csv, apply }), (data) => setResult(data as ImportResult));
  return (
    <Card>
      <CardHeader
        title="Import models from CSV"
        description="Columns: category (phone, tablet, laptop, smartwatch, audio), brand, model, releaseYear, frame, popular (yes/no), aliases (separated by ;). Existing models are matched by brand + name and updated."
      />
      <CardBody className="space-y-3">
        <Input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setResult(null);
            setCsv(file ? await file.text() : "");
          }}
        />
        <p className="text-xs text-muted">
          Example row: <code>phone,Samsung,Galaxy A57,2026,galaxy-s,no,a57</code>. Frame keys: {FRAME_KEYS.join(", ")}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={!csv} pending={pending} onClick={() => submit(false)}>
            Preview
          </Button>
          <Button type="button" size="sm" disabled={!csv || !result || result.applied || result.errors.length > 0} pending={pending} onClick={() => submit(true)}>
            Apply import
          </Button>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <Alert tone={result.errors.length ? "danger" : "success"}>
            {result.applied ? "Imported: " : "Preview: "}
            {result.created} new, {result.updated} updated, {result.brandsCreated} new brands.
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {result.errors.slice(0, 20).map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
                {result.errors.length > 20 && <li>…and {result.errors.length - 20} more</li>}
              </ul>
            )}
          </Alert>
        )}
      </CardBody>
    </Card>
  );
}

function IssueForm({ categoryId, issue, onDone }: { categoryId: string; issue?: Issue; onDone?: () => void }) {
  const { run, pending, error, fields } = useAction();
  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        run(
          () =>
            upsertIssueAction({
              id: issue?.id,
              categoryId,
              nameEn: f.get("nameEn"),
              nameHi: f.get("nameHi"),
              descriptionEn: f.get("descriptionEn"),
              descriptionHi: f.get("descriptionHi"),
              active: issue ? f.get("active") === "on" : true,
            }),
          () => {
            if (!issue) form.reset();
            onDone?.();
          },
        );
      }}
    >
      {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
      <Field label="Name (English)" error={fields.nameEn} required>
        {(p) => <Input {...p} name="nameEn" defaultValue={issue?.nameEn} />}
      </Field>
      <Field label="Name (Hindi)" hint="Optional — English is shown if empty.">
        {(p) => <Input {...p} name="nameHi" lang="hi" defaultValue={issue?.nameHi ?? ""} />}
      </Field>
      <Field label="Description (English)">
        {(p) => <Textarea {...p} name="descriptionEn" className="min-h-16" defaultValue={issue?.descriptionEn ?? ""} />}
      </Field>
      <Field label="Description (Hindi)">
        {(p) => <Textarea {...p} name="descriptionHi" lang="hi" className="min-h-16" defaultValue={issue?.descriptionHi ?? ""} />}
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2">
        {issue && <Checkbox name="active" label="Active" defaultChecked={issue.active} />}
        <Button type="submit" size="sm" pending={pending}>
          {issue ? "Save issue" : "Add issue"}
        </Button>
      </div>
    </form>
  );
}

export function DeviceCatalogEditor({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="devices-heading" className="space-y-4">
      <h2 id="devices-heading" className="text-lg font-semibold">
        Device catalogue
      </h2>
      <ModelImport />
      {categories.map((c) => (
        <Card key={c.id}>
          <CardHeader title={c.nameEn} description={c.nameHi ?? undefined} />
          <CardBody className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Brands & models</h3>
              <ul className="space-y-2">
                {c.brands.map((b) => (
                  <li key={b.id}>
                    <details className="rounded-lg border border-border">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                        {b.name}
                        {inactive(b.active)} <span className="text-xs font-normal text-muted">· {b.models.length} models</span>
                      </summary>
                      <div className="space-y-3 border-t border-border p-3">
                        <NameForm initial={b} submitLabel="Save brand" onSubmit={(v) => upsertBrandAction({ id: b.id, categoryId: c.id, ...v })} />
                        <ul className="space-y-2">
                          {b.models.map((m) => (
                            <li key={m.id}>
                              <ModelForm brandId={b.id} model={m} />
                            </li>
                          ))}
                        </ul>
                        <div>
                          <p className="mb-1 text-xs text-muted">Add model</p>
                          <ModelForm brandId={b.id} />
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <p className="mb-1 text-xs text-muted">Add brand</p>
                <NameForm submitLabel="Add brand" onSubmit={(v) => upsertBrandAction({ categoryId: c.id, ...v })} />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Issue types</h3>
              <ul className="space-y-2">
                {c.issues.map((i) => (
                  <li key={i.id}>
                    <details className="rounded-lg border border-border">
                      <summary className="cursor-pointer px-3 py-2 text-sm">
                        {i.nameEn}
                        {i.nameHi && <span className="text-muted"> · {i.nameHi}</span>}
                        {inactive(i.active)}
                      </summary>
                      <div className="border-t border-border p-3">
                        <IssueForm categoryId={c.id} issue={i} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-primary">Add issue type</summary>
                <div className="mt-2">
                  <IssueForm categoryId={c.id} />
                </div>
              </details>
            </div>
          </CardBody>
        </Card>
      ))}
    </section>
  );
}

type PriceItem = {
  id: string;
  kind: string;
  name: string;
  unitPaise: number;
  partGrade: string | null;
  modelId: string | null;
  issueTypeId: string | null;
  active: boolean;
  modelName: string | null;
  issueName: string | null;
};
type Option = { id: string; label: string };
const KINDS = ["LABOUR", "PART", "DIAGNOSIS_FEE", "DISCOUNT", "OTHER"] as const;
const KIND_LABEL: Record<string, string> = { LABOUR: "Labour", PART: "Part", DIAGNOSIS_FEE: "Diagnosis fee", DISCOUNT: "Discount", OTHER: "Other" };

function PriceItemForm({ item, modelOptions, issueOptions, onDone }: { item?: PriceItem; modelOptions: Option[]; issueOptions: Option[]; onDone?: () => void }) {
  const { run, pending, error, fields, setError } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const unitPaise = rupeesToPaise(String(f.get("price") ?? ""));
        if (unitPaise === null) return setError("Enter a valid price in rupees, e.g. 1299 or 1299.50.");
        run(
          () =>
            upsertPriceItemAction({
              id: item?.id,
              kind: f.get("kind"),
              name: f.get("name"),
              unitPaise,
              partGrade: f.get("partGrade") || null,
              modelId: f.get("modelId") || null,
              issueTypeId: f.get("issueTypeId") || null,
              active: item ? f.get("active") === "on" : true,
            }),
          () => {
            if (!item) form.reset();
            onDone?.();
          },
        );
      }}
    >
      {error && <Alert tone="danger" className="sm:col-span-2 lg:col-span-3">{error}</Alert>}
      <Field label="Name" error={fields.name} required>
        {(p) => <Input {...p} name="name" defaultValue={item?.name} />}
      </Field>
      <Field label="Kind" required>
        {(p) => (
          <Select {...p} name="kind" defaultValue={item?.kind ?? "LABOUR"}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Unit price (₹)" error={fields.unitPaise} required>
        {(p) => <Input {...p} name="price" inputMode="decimal" defaultValue={item ? (item.unitPaise / 100).toFixed(2) : ""} />}
      </Field>
      <Field label="Part grade" hint="e.g. original, OEM, compatible">
        {(p) => <Input {...p} name="partGrade" defaultValue={item?.partGrade ?? ""} />}
      </Field>
      <Field label="Only for model" hint="Leave empty for all models">
        {(p) => (
          <Select {...p} name="modelId" defaultValue={item?.modelId ?? ""}>
            <option value="">All models</option>
            {modelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Only for issue" hint="Leave empty for all issues">
        {(p) => (
          <Select {...p} name="issueTypeId" defaultValue={item?.issueTypeId ?? ""}>
            <option value="">All issues</option>
            {issueOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-3">
        {item && <Checkbox name="active" label="Active" defaultChecked={item.active} />}
        <Button type="submit" size="sm" pending={pending}>
          {item ? "Save item" : "Add price item"}
        </Button>
      </div>
    </form>
  );
}

export function PriceItemsEditor({ items, modelOptions, issueOptions }: { items: PriceItem[]; modelOptions: Option[]; issueOptions: Option[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section aria-labelledby="prices-heading">
      <Card>
        <CardHeader title={<span id="prices-heading">Price items</span>} description="Predefined lines staff can add to quotes. Prices include no tax; GST is added on the quote." />
        <CardBody className="space-y-4">
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {i.name}
                      {inactive(i.active)}
                    </p>
                    <p className="text-muted">
                      {KIND_LABEL[i.kind]}
                      {i.partGrade && ` · ${i.partGrade}`}
                      {i.modelName && ` · ${i.modelName}`}
                      {i.issueName && ` · ${i.issueName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatPaise(i.unitPaise)}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(editing === i.id ? null : i.id)} aria-expanded={editing === i.id}>
                      {editing === i.id ? "Close" : "Edit"}
                    </Button>
                  </div>
                </div>
                {editing === i.id && (
                  <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                    <PriceItemForm item={i} modelOptions={modelOptions} issueOptions={issueOptions} onDone={() => setEditing(null)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <details className="rounded-lg border border-dashed border-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-primary">Add price item</summary>
            <div className="mt-3">
              <PriceItemForm modelOptions={modelOptions} issueOptions={issueOptions} />
            </div>
          </details>
        </CardBody>
      </Card>
    </section>
  );
}

type Estimate = { id: string; issueTypeId: string; modelId: string | null; minPaise: number; maxPaise: number | null; active: boolean; issueName: string; modelName: string | null };

function EstimateForm({ item, modelOptions, issueOptions, onDone }: { item?: Estimate; modelOptions: Option[]; issueOptions: Option[]; onDone?: () => void }) {
  const { run, pending, error, fields, setError } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const minPaise = rupeesToPaise(String(f.get("min") ?? ""));
        const maxRaw = String(f.get("max") ?? "").trim();
        const maxPaise = maxRaw ? rupeesToPaise(maxRaw) : null;
        if (minPaise === null || (maxRaw && maxPaise === null)) return setError("Enter valid prices in rupees, e.g. 2499.");
        if (maxPaise !== null && maxPaise < minPaise) return setError("The upper price must be at least the starting price.");
        run(
          () =>
            upsertEstimateAction({
              id: item?.id,
              issueTypeId: f.get("issueTypeId"),
              modelId: f.get("modelId") || null,
              minPaise,
              maxPaise,
              active: item ? f.get("active") === "on" : true,
            }),
          () => {
            if (!item) form.reset();
            onDone?.();
          },
        );
      }}
    >
      {error && <Alert tone="danger" className="sm:col-span-2 lg:col-span-4">{error}</Alert>}
      <Field label="Repair service" error={fields.issueTypeId} required>
        {(p) => (
          <Select {...p} name="issueTypeId" defaultValue={item?.issueTypeId ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {issueOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Only for model" hint="Empty = default for every model">
        {(p) => (
          <Select {...p} name="modelId" defaultValue={item?.modelId ?? ""}>
            <option value="">All models</option>
            {modelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="From (₹)" error={fields.minPaise} required>
        {(p) => <Input {...p} name="min" inputMode="decimal" defaultValue={item ? (item.minPaise / 100).toFixed(0) : ""} />}
      </Field>
      <Field label="Up to (₹)" hint="Optional — shows a range" error={fields.maxPaise}>
        {(p) => <Input {...p} name="max" inputMode="decimal" defaultValue={item?.maxPaise ? (item.maxPaise / 100).toFixed(0) : ""} />}
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-4">
        {item && <Checkbox name="active" label="Active" defaultChecked={item.active} />}
        <Button type="submit" size="sm" pending={pending}>
          {item ? "Save estimate" : "Add estimate"}
        </Button>
      </div>
    </form>
  );
}

/** Estimated prices customers see on repair model pages. A model-specific row overrides the default for that service. */
export function EstimatesEditor({ items, modelOptions, issueOptions }: { items: Estimate[]; modelOptions: Option[]; issueOptions: Option[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const price = (e: Estimate) => (e.maxPaise ? `${formatPaise(e.minPaise)} – ${formatPaise(e.maxPaise)}` : `from ${formatPaise(e.minPaise)}`);
  return (
    <section aria-labelledby="estimates-heading">
      <Card>
        <CardHeader
          title={<span id="estimates-heading">Repair estimates</span>}
          description="Estimated prices shown to customers on each model's repair page. The final price is still set by the quote after diagnosis."
        />
        <CardBody className="space-y-4">
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {i.issueName}
                      {inactive(i.active)}
                    </p>
                    <p className="text-muted">{i.modelName ?? "Default for all models"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{price(i)}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(editing === i.id ? null : i.id)} aria-expanded={editing === i.id}>
                      {editing === i.id ? "Close" : "Edit"}
                    </Button>
                  </div>
                </div>
                {editing === i.id && (
                  <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                    <EstimateForm item={i} modelOptions={modelOptions} issueOptions={issueOptions} onDone={() => setEditing(null)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <details className="rounded-lg border border-dashed border-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-primary">Add estimate</summary>
            <div className="mt-3">
              <EstimateForm modelOptions={modelOptions} issueOptions={issueOptions} />
            </div>
          </details>
        </CardBody>
      </Card>
    </section>
  );
}
