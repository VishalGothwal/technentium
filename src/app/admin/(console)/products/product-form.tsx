"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DevicePicker } from "@/components/device/device-picker";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { rupeesToPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { createProductAction, updateProductAction } from "./actions";

export type ProductFormValues = {
  slug: string;
  sku: string;
  nameEn: string;
  nameHi: string;
  summaryEn: string;
  summaryHi: string;
  descriptionEn: string;
  descriptionHi: string;
  categoryId: string;
  typeId: string;
  price: string;
  mrp: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  featured: boolean;
  universal: boolean;
  lowStockThreshold: string;
  specs: { labelEn: string; labelHi: string; value: string }[];
  imageIds: string[];
  compat: { id: string; label: string }[];
  seoTitle: string;
  metaDescription: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

/** Create/edit product (PRD §7.4): bilingual copy, pricing, images, specs, compatibility mapping and SEO. */
type CategoryOption = { id: string; nameEn: string; types: { id: string; nameEn: string; active: boolean }[] };

export function ProductForm({ productId, initial, categories }: { productId?: string; initial: ProductFormValues; categories: CategoryOption[] }) {
  const router = useRouter();
  const { run, pending, error, fields } = useAction();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!productId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductFormValues>(k: K, value: ProductFormValues[K]) => {
    setSaved(false);
    setV((prev) => ({ ...prev, [k]: value }));
  };
  const typeOptions = categories.find((c) => c.id === v.categoryId)?.types ?? [];
  const text = (k: keyof ProductFormValues) => (e: { target: { value: string } }) => set(k, e.target.value as never);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files).slice(0, 10 - v.imageIds.length)) {
        const body = new FormData();
        body.set("file", file);
        body.set("purpose", "PRODUCT_IMAGE");
        body.set("altEn", v.nameEn);
        const res = await apiFetch<{ id: string }>("/api/v1/media", { method: "POST", body });
        setV((prev) => ({ ...prev, imageIds: [...prev.imageIds, res.id] }));
      }
    } catch (e) {
      setUploadError(e instanceof ApiRequestError ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const next = [...v.imageIds];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("imageIds", next);
  };

  const pricePaise = rupeesToPaise(v.price);
  const mrpPaise = v.mrp.trim() ? rupeesToPaise(v.mrp) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      slug: v.slug,
      sku: v.sku,
      nameEn: v.nameEn,
      nameHi: v.nameHi,
      summaryEn: v.summaryEn,
      summaryHi: v.summaryHi,
      descriptionEn: v.descriptionEn,
      descriptionHi: v.descriptionHi,
      categoryId: v.categoryId,
      typeId: v.typeId || null,
      pricePaise: pricePaise ?? -1,
      mrpPaise: v.mrp.trim() ? (mrpPaise ?? -1) : null,
      status: v.status,
      featured: v.featured,
      universal: v.universal,
      lowStockThreshold: Number(v.lowStockThreshold) || 0,
      specs: v.specs.filter((s) => s.labelEn.trim() && s.value.trim()),
      imageIds: v.imageIds,
      compatibleModelIds: v.universal ? [] : v.compat.map((c) => c.id),
      seoTitle: v.seoTitle,
      metaDescription: v.metaDescription,
    };
    if (productId) run(() => updateProductAction(productId, payload), () => setSaved(true));
    else run(() => createProductAction(payload), (data) => router.push(`/admin/products/${(data as { id: string }).id}`));
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Product saved.</Alert>}

      <Card>
        <CardHeader title="Basics" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name (English)" error={fields.nameEn} required>
            {(p) => (
              <Input
                {...p}
                value={v.nameEn}
                onChange={(e) => {
                  set("nameEn", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
            )}
          </Field>
          <Field label="Name (Hindi)" error={fields.nameHi}>
            {(p) => <Input {...p} lang="hi" value={v.nameHi} onChange={text("nameHi")} />}
          </Field>
          <Field label="URL slug" hint={`/protection/${v.slug || "…"}`} error={fields.slug} required>
            {(p) => (
              <Input
                {...p}
                value={v.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
            )}
          </Field>
          <Field label="SKU" error={fields.sku} required>
            {(p) => <Input {...p} value={v.sku} onChange={text("sku")} />}
          </Field>
          <Field label="Category" error={fields.categoryId} required>
            {(p) => (
              <Select
                {...p}
                value={v.categoryId}
                onChange={(e) => {
                  // Types belong to a category, so changing category clears the type.
                  setV((prev) => ({ ...prev, categoryId: e.target.value, typeId: "" }));
                  setSaved(false);
                }}
              >
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Type" hint="Shoppers filter by type, e.g. HD+, Privacy, Anti-yellow." error={fields.typeId}>
            {(p) => (
              <Select {...p} value={v.typeId} onChange={text("typeId")} disabled={!typeOptions.length}>
                <option value="">{typeOptions.length ? "No type" : "No types in this category"}</option>
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameEn}
                    {t.active ? "" : " (inactive)"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status" hint="Only active products are visible in the store." error={fields.status}>
            {(p) => (
              <Select {...p} value={v.status} onChange={(e) => set("status", e.target.value as ProductFormValues["status"])}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            )}
          </Field>
          <Field label="Price (₹)" error={pricePaise === null && v.price ? "Enter an amount like 499 or 499.50" : fields.pricePaise} required>
            {(p) => <Input {...p} inputMode="decimal" value={v.price} onChange={text("price")} />}
          </Field>
          <Field label="MRP (₹, optional)" hint="Shown struck through with the discount." error={v.mrp && mrpPaise === null ? "Enter a valid amount" : fields.mrpPaise}>
            {(p) => <Input {...p} inputMode="decimal" value={v.mrp} onChange={text("mrp")} />}
          </Field>
          <Field label="Low-stock threshold" error={fields.lowStockThreshold}>
            {(p) => <Input {...p} type="number" min={0} value={v.lowStockThreshold} onChange={text("lowStockThreshold")} />}
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <Checkbox label="Featured in the store" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} />
            <Checkbox label="Universal — fits every device" checked={v.universal} onChange={(e) => set("universal", e.target.checked)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Copy" description="Hindi falls back to English when left empty." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Summary (English)" error={fields.summaryEn}>
            {(p) => <Textarea {...p} value={v.summaryEn} onChange={text("summaryEn")} maxLength={300} />}
          </Field>
          <Field label="Summary (Hindi)" error={fields.summaryHi}>
            {(p) => <Textarea {...p} lang="hi" value={v.summaryHi} onChange={text("summaryHi")} maxLength={300} />}
          </Field>
          <Field label="Description (English)" hint="Blank lines separate paragraphs." error={fields.descriptionEn}>
            {(p) => <Textarea {...p} className="min-h-40" value={v.descriptionEn} onChange={text("descriptionEn")} />}
          </Field>
          <Field label="Description (Hindi)" error={fields.descriptionHi}>
            {(p) => <Textarea {...p} lang="hi" className="min-h-40" value={v.descriptionHi} onChange={text("descriptionHi")} />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Images" description="JPEG, PNG or WebP up to 10 MB. The first image is the main photo. Without images, a category illustration is shown." />
        <CardBody className="space-y-3">
          {uploadError && <Alert tone="danger">{uploadError}</Alert>}
          {fields.imageIds && <Alert tone="danger">{fields.imageIds}</Alert>}
          <ul className="flex flex-wrap gap-3">
            {v.imageIds.map((id, i) => (
              <li key={id} className="w-28 space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(id)} alt={`Product image ${i + 1}`} className="aspect-square w-28 rounded-lg border border-border object-cover" />
                <div className="flex justify-between text-xs">
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" aria-label={`Move image ${i + 1} left`}>
                    ←
                  </button>
                  <button type="button" onClick={() => set("imageIds", v.imageIds.filter((x) => x !== id))} className="text-danger hover:underline">
                    Remove
                  </button>
                  <button type="button" onClick={() => moveImage(i, 1)} disabled={i === v.imageIds.length - 1} className="px-1 disabled:opacity-30" aria-label={`Move image ${i + 1} right`}>
                    →
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {v.imageIds.length < 10 && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium hover:bg-surface-muted">
              {uploading ? "Uploading…" : "Upload images"}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files)} />
            </label>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Specifications" />
        <CardBody className="space-y-2">
          {v.specs.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <Input aria-label={`Spec ${i + 1} label (English)`} placeholder="Label (English)" value={s.labelEn} onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, labelEn: e.target.value } : x)))} />
              <Input aria-label={`Spec ${i + 1} label (Hindi)`} placeholder="Label (Hindi)" lang="hi" value={s.labelHi} onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, labelHi: e.target.value } : x)))} />
              <Input aria-label={`Spec ${i + 1} value`} placeholder="Value" value={s.value} onChange={(e) => set("specs", v.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="sm" className="h-11" onClick={() => set("specs", v.specs.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => set("specs", [...v.specs, { labelEn: "", labelHi: "", value: "" }])}>
            Add specification
          </Button>
        </CardBody>
      </Card>

      {!v.universal && (
        <Card>
          <CardHeader title={`Device compatibility (${v.compat.length})`} description="Customers can only add this product for these models. Search to add more." />
          <CardBody className="space-y-4">
            {fields.compatibleModelIds && <Alert tone="danger">{fields.compatibleModelIds}</Alert>}
            {v.compat.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {v.compat.map((c) => (
                  <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted py-1 pr-1 pl-3 text-sm">
                    {c.label}
                    <button type="button" onClick={() => set("compat", v.compat.filter((x) => x.id !== c.id))} className="rounded-full px-2 hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${c.label}`}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <DevicePicker
              value={null}
              onChange={(d) => {
                if (d && !v.compat.some((c) => c.id === d.id)) set("compat", [...v.compat, { id: d.id, label: `${d.brand.name} ${d.name}` }]);
              }}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Search engine listing" description="Optional. Defaults to the product name and summary." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO title" hint={`${v.seoTitle.length}/70`} error={fields.seoTitle}>
            {(p) => <Input {...p} value={v.seoTitle} onChange={text("seoTitle")} maxLength={70} />}
          </Field>
          <Field label="Meta description" hint={`${v.metaDescription.length}/170`} error={fields.metaDescription}>
            {(p) => <Textarea {...p} value={v.metaDescription} onChange={text("metaDescription")} maxLength={170} />}
          </Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button type="submit" pending={pending}>
          {productId ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
