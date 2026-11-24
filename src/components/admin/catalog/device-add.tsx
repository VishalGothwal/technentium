"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDeviceAction, importModelsCsvAction } from "@/app/admin/actions";
import { useAction } from "@/components/admin/use-action";
import { ImageUpload } from "@/components/admin/content/media-upload";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { pasteListToCsv } from "@/lib/device-import";
import { FRAME_KEYS } from "@/lib/device-frames";

export type CatalogOption = { id: string; slug: string; nameEn: string; brands: { id: string; name: string; slug: string }[] };

const NEW_BRAND = "__new";

/** Add one device: category, an existing or new brand, model, year, popular and photo. Opens the device page after. */
export function AddDeviceDialog({ categories, open, onClose }: { categories: CatalogOption[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error, fields } = useAction();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const brands = categories.find((c) => c.id === categoryId)?.brands ?? [];
  const [brandId, setBrandId] = useState("");
  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const newBrand = brandId === NEW_BRAND || brands.length === 0;

  return (
    <Dialog open={open} onClose={onClose} title="Add device" description="It is added to the booking flow, repair pages, studio and shop compatibility right away.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const year = String(f.get("releaseYear") ?? "").trim();
          run(
            () =>
              addDeviceAction({
                categoryId,
                ...(newBrand ? { brandName: f.get("brandName") } : { brandId }),
                name: f.get("name"),
                releaseYear: year ? Number(year) : null,
                popular: f.get("popular") === "on",
                imageMediaId,
              }),
            (data) => router.push(`/admin/devices/${(data as { id: string }).id}`),
          );
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" required>
            {(p) => (
              <Select {...p} value={categoryId} onChange={(e) => (setCategoryId(e.target.value), setBrandId(""))}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Brand" required>
            {(p) => (
              <Select {...p} value={newBrand ? NEW_BRAND : brandId} onChange={(e) => setBrandId(e.target.value)} required>
                <option value="" disabled>
                  Choose a brand
                </option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value={NEW_BRAND}>+ New brand…</option>
              </Select>
            )}
          </Field>
        </div>
        {newBrand && (
          <Field label="New brand name" required error={fields.brandName}>
            {(p) => <Input {...p} name="brandName" maxLength={60} placeholder="e.g. Honor" />}
          </Field>
        )}
        <Field label="Model name" hint="Without the brand, e.g. “Galaxy A57” or “Inspiron 14 5440”." required error={fields.name}>
          {(p) => <Input {...p} name="name" maxLength={80} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Release year">{(p) => <Input {...p} name="releaseYear" type="number" min={2000} max={2100} />}</Field>
          <div className="flex items-end pb-2">
            <Checkbox name="popular" label="Popular (shown first)" />
          </div>
        </div>
        <ImageUpload value={imageMediaId} onChange={setImageMediaId} purpose="DEVICE_IMAGE" label="Product photo" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={pending}>
            Add device
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

type ImportResult = { created: number; updated: number; brandsCreated: number; errors: { line: number; message: string }[]; applied: boolean };

/** Add many devices: paste "Brand, Model, Year" lines for one category, or upload the importer's CSV. Preview, then apply. */
export function BulkAddDialog({ categories, open, onClose }: { categories: CatalogOption[]; open: boolean; onClose: () => void }) {
  const { run, pending, error } = useAction();
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [category, setCategory] = useState(categories[0]?.slug ?? "phone");
  const [text, setText] = useState("");
  const [file, setFile] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const csv = mode === "paste" ? (text.trim() ? pasteListToCsv(category, text) : "") : file;
  const submit = (apply: boolean) => run(() => importModelsCsvAction({ csv, apply }), (data) => setResult(data as ImportResult));
  const reset = () => setResult(null);

  return (
    <Dialog open={open} onClose={onClose} title="Bulk add devices" description="Existing devices (same brand and name) are updated, not duplicated. New brands are created." className="max-w-2xl">
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-border p-1 text-sm" role="tablist">
          {(
            [
              ["paste", "Paste list"],
              ["csv", "CSV file"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => (setMode(m), reset())}
              className={mode === m ? "rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground" : "rounded-md px-3 py-1.5 text-muted hover:text-foreground"}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "paste" ? (
          <>
            <Field label="Category">
              {(p) => (
                <Select {...p} value={category} onChange={(e) => (setCategory(e.target.value), reset())}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.nameEn}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Devices" hint="One per line: Brand, Model, Year (year optional). You can paste from a spreadsheet.">
              {(p) => <Textarea {...p} rows={8} value={text} onChange={(e) => (setText(e.target.value), reset())} placeholder={"Samsung, Galaxy A57, 2026\nSamsung, Galaxy M37, 2026\nNothing, Phone (4), 2026"} className="font-mono text-sm" />}
            </Field>
          </>
        ) : (
          <>
            <Input
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                reset();
                setFile(f ? await f.text() : "");
              }}
            />
            <p className="text-xs text-muted">
              Columns: category (phone, tablet, laptop, smartwatch, audio), brand, model, releaseYear, frame, popular (yes/no), aliases (separated by ;). Example:{" "}
              <code>phone,Samsung,Galaxy A57,2026,galaxy-s,no,a57</code>. Frame keys: {FRAME_KEYS.join(", ")}.
            </p>
          </>
        )}

        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <Alert tone={result.errors.length ? "danger" : "success"}>
            {result.applied ? "Added: " : "Preview: "}
            {result.created} new, {result.updated} updated, {result.brandsCreated} new brands.
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {result.errors.slice(0, 20).map((e) => (
                  <li key={e.line}>
                    Line {mode === "paste" ? e.line - 1 : e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {result?.applied ? "Done" : "Cancel"}
          </Button>
          <Button type="button" variant="secondary" disabled={!csv} pending={pending && !result} onClick={() => submit(false)}>
            Preview
          </Button>
          <Button type="button" disabled={!csv || !result || result.applied || result.errors.length > 0} pending={pending && !!result} onClick={() => submit(true)}>
            Add {result && !result.applied ? result.created + result.updated : ""} devices
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
