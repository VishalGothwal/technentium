"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rupeesToPaise } from "@/lib/format";
import { COLLECTIONS, designStyleSchema, PATTERNS, type CollectionKey, type DesignStyle, type DeviceKind } from "@/lib/customization/style";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { DevicePreview } from "@/components/customization/device-preview";
import { saveDesignAction, setDesignActiveAction } from "./actions";

export type DesignFormValues = {
  slug: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  collection: CollectionKey;
  style: DesignStyle;
  basePricePaise: number | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

export function DesignForm({ id, initial }: { id: string | null; initial: DesignFormValues }) {
  const router = useRouter();
  const { run, pending, error, fields } = useAction();
  const [v, setV] = useState(initial);
  const [price, setPrice] = useState(initial.basePricePaise != null ? String(initial.basePricePaise / 100) : "");
  const [json, setJson] = useState(() => JSON.stringify(initial.style, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<DeviceKind>("phone");
  const [saved, setSaved] = useState(false);

  const set = (patch: Partial<DesignFormValues>) => {
    setSaved(false);
    setV((x) => ({ ...x, ...patch }));
  };
  const setStyle = (patch: Partial<DesignStyle>) => {
    const style = { ...v.style, ...patch };
    set({ style });
    setJson(JSON.stringify(style, null, 2));
    setJsonError(null);
  };

  function applyJson(text: string) {
    setJson(text);
    try {
      const parsed = designStyleSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return setJsonError("Style JSON doesn't match the schema (pattern, 2–5 #rrggbb colours, density 1–10, angle 0–360).");
      setJsonError(null);
      set({ style: parsed.data });
    } catch {
      setJsonError("Invalid JSON.");
    }
  }

  function save() {
    const basePricePaise = price.trim() ? rupeesToPaise(price) : null;
    run(() => saveDesignAction(id, { ...v, basePricePaise }), (data) => {
      setSaved(true);
      const newId = (data as { id: string } | null)?.id;
      if (!id && newId) router.replace(`/admin/designs/${newId}`);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardBody className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Saved. The public catalogue is updated.</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English)" error={fields.nameEn} required>
              {(p) => <Input {...p} value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value, ...(id ? {} : { slug: slugify(e.target.value) }) })} />}
            </Field>
            <Field label="Name (Hindi)" error={fields.nameHi}>
              {(p) => <Input {...p} value={v.nameHi} onChange={(e) => set({ nameHi: e.target.value })} />}
            </Field>
            <Field label="Slug" hint="Used in links: /customize/studio?design=slug" error={fields.slug} required>
              {(p) => <Input {...p} value={v.slug} onChange={(e) => set({ slug: e.target.value })} />}
            </Field>
            <Field label="Collection" error={fields.collection}>
              {(p) => (
                <Select {...p} value={v.collection} onChange={(e) => set({ collection: e.target.value as CollectionKey })}>
                  {COLLECTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Description (English)" error={fields.descriptionEn}>
              {(p) => <Textarea {...p} className="min-h-16" maxLength={500} value={v.descriptionEn} onChange={(e) => set({ descriptionEn: e.target.value })} />}
            </Field>
            <Field label="Description (Hindi)" error={fields.descriptionHi}>
              {(p) => <Textarea {...p} className="min-h-16" maxLength={500} value={v.descriptionHi} onChange={(e) => set({ descriptionHi: e.target.value })} />}
            </Field>
            <Field label="Base price (₹)" hint="Leave empty for the default blank price." error={fields.basePricePaise}>
              {(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => (setPrice(e.target.value.replace(/[^\d.]/g, "")), setSaved(false))} />}
            </Field>
            <Field label="Sort order" error={fields.sortOrder}>
              {(p) => <Input {...p} type="number" min={0} max={9999} value={v.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) || 0 })} />}
            </Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Checkbox checked={v.featured} onChange={(e) => set({ featured: e.target.checked })} label="Featured (shown in the hero)" />
            <Checkbox checked={v.active} onChange={(e) => set({ active: e.target.checked })} label="Active (visible to customers)" />
          </div>

          <fieldset className="space-y-4 border-t border-border pt-5">
            <legend className="text-sm font-semibold">Style</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Pattern">
                {(p) => (
                  <Select {...p} value={v.style.pattern} onChange={(e) => setStyle({ pattern: e.target.value as DesignStyle["pattern"] })}>
                    {PATTERNS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <label className="block text-sm">
                <span className="font-medium">Density: {v.style.density}</span>
                <input type="range" min={1} max={10} value={v.style.density} onChange={(e) => setStyle({ density: Number(e.target.value) })} className="mt-3 w-full accent-[var(--primary)]" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Angle: {v.style.angle}°</span>
                <input type="range" min={0} max={360} value={v.style.angle} onChange={(e) => setStyle({ angle: Number(e.target.value) })} className="mt-3 w-full accent-[var(--primary)]" />
              </label>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Palette (first colour is the background)</p>
              <div className="flex flex-wrap items-center gap-2">
                {v.style.palette.map((c, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-lg border border-border p-1">
                    <input type="color" value={c} aria-label={`Colour ${i + 1}`} onChange={(e) => setStyle({ palette: v.style.palette.map((x, k) => (k === i ? e.target.value : x)) })} className="size-9 cursor-pointer bg-transparent" />
                    <span className="font-mono text-xs">{c}</span>
                    {v.style.palette.length > 2 && (
                      <button type="button" aria-label={`Remove colour ${i + 1}`} onClick={() => setStyle({ palette: v.style.palette.filter((_, k) => k !== i) })} className="px-1 text-muted hover:text-danger">
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {v.style.palette.length < 5 && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setStyle({ palette: [...v.style.palette, "#ffffff"] })}>
                    Add colour
                  </Button>
                )}
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Style JSON (advanced)</summary>
              <Textarea aria-label="Style JSON" className="mt-2 min-h-40 font-mono text-xs" value={json} onChange={(e) => applyJson(e.target.value)} />
              {jsonError && <p className="mt-1 text-sm text-danger">{jsonError}</p>}
            </details>
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => router.push("/admin/designs")}>
              Back
            </Button>
            <Button type="button" pending={pending} disabled={!!jsonError} onClick={save}>
              {id ? "Save changes" : "Create design"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader
          title="Live preview"
          action={
            <Select aria-label="Preview device" className="h-9 w-auto" value={previewKind} onChange={(e) => setPreviewKind(e.target.value as DeviceKind)}>
              <option value="phone">Phone</option>
              <option value="tablet">Tablet</option>
              <option value="laptop">Laptop</option>
            </Select>
          }
        />
        <div className="flex h-[28rem] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#2a2352_0%,#0b0c14_75%)] p-6">
          <DevicePreview kind={previewKind} style={v.style} finish="gloss" coverage="camera" seed={v.slug || "preview"} label="Design preview" className="h-full w-full" />
        </div>
      </Card>
    </div>
  );
}

export function ArchiveToggle({ id, active }: { id: string; active: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <>
      <Button type="button" size="sm" variant="ghost" pending={pending} onClick={() => run(() => setDesignActiveAction(id, !active))}>
        {active ? "Archive" : "Restore"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </>
  );
}
