"use client";
import { useState } from "react";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { saveDesignOptionAction } from "./actions";

type Option = {
  id: string;
  kind: "FINISH" | "COVERAGE";
  slug: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  priceDeltaPaise: number;
  active: boolean;
  sortOrder: number;
};

const blank = (kind: Option["kind"]): Omit<Option, "id"> => ({ kind, slug: "", nameEn: "", nameHi: "", descriptionEn: "", descriptionHi: "", priceDeltaPaise: 0, active: true, sortOrder: 100 });

/**
 * Finish and coverage options with price deltas. The preview renderer knows these slugs:
 * finish matte/gloss/metallic/carbon/leather; coverage back/camera/sides/full.
 */
export function OptionsEditor({ options }: { options: Option[] }) {
  const [editing, setEditing] = useState<(Omit<Option, "id"> & { id: string | null }) | null>(null);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(["FINISH", "COVERAGE"] as const).map((kind) => (
        <div key={kind} className="rounded-[var(--radius)] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold">{kind === "FINISH" ? "Finishes" : "Coverage"}</h3>
            <Button size="sm" variant="secondary" onClick={() => setEditing({ id: null, ...blank(kind) })}>
              Add
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {options
              .filter((o) => o.kind === kind)
              .map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className={o.active ? "" : "opacity-60"}>
                    <span className="font-medium">{o.nameEn}</span> <span className="font-mono text-xs text-muted">{o.slug}</span>
                    {!o.active && <Badge className="ml-2">Archived</Badge>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-muted">{o.priceDeltaPaise ? `+${formatPaise(o.priceDeltaPaise)}` : "Included"}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>
                      Edit
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {editing && <OptionDialog key={editing.id ?? `new-${editing.kind}`} value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OptionDialog({ value, onClose }: { value: Omit<Option, "id"> & { id: string | null }; onClose: () => void }) {
  const { run, pending, error, fields } = useAction();
  const [v, setV] = useState(value);
  const [price, setPrice] = useState(String(value.priceDeltaPaise / 100));
  const set = (patch: Partial<Option>) => setV((x) => ({ ...x, ...patch }));
  return (
    <Dialog open onClose={onClose} title={value.id ? `Edit ${value.nameEn}` : `New ${value.kind === "FINISH" ? "finish" : "coverage"} option`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const { id, ...rest } = v;
          run(() => saveDesignOptionAction(id, { ...rest, priceDeltaPaise: rupeesToPaise(price) ?? -1 }), onClose);
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Type">
          {(p) => (
            <Select {...p} value={v.kind} disabled={!!value.id} onChange={(e) => set({ kind: e.target.value as Option["kind"] })}>
              <option value="FINISH">Finish</option>
              <option value="COVERAGE">Coverage</option>
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name (English)" error={fields.nameEn} required>
            {(p) => <Input {...p} value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />}
          </Field>
          <Field label="Name (Hindi)">
            {(p) => <Input {...p} value={v.nameHi} onChange={(e) => set({ nameHi: e.target.value })} />}
          </Field>
          <Field label="Slug" error={fields.slug} required>
            {(p) => <Input {...p} value={v.slug} onChange={(e) => set({ slug: e.target.value })} />}
          </Field>
          <Field label="Price add-on (₹)" error={fields.priceDeltaPaise}>
            {(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />}
          </Field>
          <Field label="Description (English)">
            {(p) => <Input {...p} value={v.descriptionEn} onChange={(e) => set({ descriptionEn: e.target.value })} />}
          </Field>
          <Field label="Description (Hindi)">
            {(p) => <Input {...p} value={v.descriptionHi} onChange={(e) => set({ descriptionHi: e.target.value })} />}
          </Field>
          <Field label="Sort order">
            {(p) => <Input {...p} type="number" value={v.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) || 0 })} />}
          </Field>
        </div>
        <Checkbox checked={v.active} onChange={(e) => set({ active: e.target.checked })} label="Active" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
