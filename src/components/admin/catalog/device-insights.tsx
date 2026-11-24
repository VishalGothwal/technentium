"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { upsertModelAction } from "@/app/admin/actions";
import { useAction } from "@/components/admin/use-action";
import { ImageUpload } from "@/components/admin/content/media-upload";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import { AddDeviceDialog, BulkAddDialog, type CatalogOption } from "./device-add";

/** One row per listed device, with what each section of the site has for it (from listDeviceInsights). */
export type InsightRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  brandActive: boolean;
  popular: boolean;
  releaseYear: number | null;
  imageMediaId: string | null;
  brandId: string;
  brandName: string;
  brandSlug: string;
  categorySlug: string;
  categoryName: string;
  series: string | null;
  hasSpec: boolean;
  specStatus: string | null;
  has3d: boolean;
  estimates: number;
  products: number;
  designs: number;
  bookings: number;
};

type Missing = "" | "photo" | "spec" | "3d" | "products" | "prices";
const MISSING: Record<Exclude<Missing, "">, { label: string; test: (r: InsightRow) => boolean }> = {
  photo: { label: "Missing photo", test: (r) => !r.imageMediaId },
  spec: { label: "No spec sheet", test: (r) => !r.hasSpec },
  "3d": { label: "No 3D model (generated)", test: (r) => !r.has3d },
  products: { label: "No protection products", test: (r) => r.products === 0 },
  prices: { label: "No own repair prices", test: (r) => r.estimates === 0 },
};

const PAGE = 60;
const VIEW_KEY = "admin.devices.view";
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const live = (r: InsightRow) => r.active && r.brandActive;
const brandKey = (r: Pick<InsightRow, "categorySlug" | "brandSlug">) => `${r.categorySlug}/${r.brandSlug}`;

type View = "blocks" | "list";
/** The remembered view (per browser); storage can be unavailable, so every access is guarded. */
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "blocks";
  } catch {
    return "blocks";
  }
};
const subscribeView = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function Meter({ value, of, className }: { value: number; of: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct(value, of)}%` }} />
      </span>
      <span className="text-xs tabular-nums">{pct(value, of)}%</span>
    </span>
  );
}

function StatCard({ label, value, of, hint }: { label: string; value: number; of?: number; hint?: string }) {
  return (
    <Card>
      <CardBody className="space-y-1 py-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
        <p className="text-2xl font-bold tabular-nums">
          {value}
          {of !== undefined && <span className="ml-1 text-sm font-medium text-muted">/ {of}</span>}
        </p>
        {of !== undefined && <Meter value={value} of={of} />}
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </CardBody>
    </Card>
  );
}

/** Repair · Spec · 3D · Protection — filled (dark) or missing (outlined). */
function SectionChips({ r, className }: { r: InsightRow; className?: string }) {
  const chip = (on: boolean, label: string, title: string) => (
    <span title={title} className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", on ? "border-foreground bg-foreground text-primary-foreground" : "border-border text-muted")}>
      {label}
    </span>
  );
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {chip(r.estimates > 0, "Prices", r.estimates ? `${r.estimates} own repair prices` : "Uses default repair prices")}
      {chip(r.hasSpec, "Spec", r.specStatus ? `Spec sheet: ${r.specStatus.toLowerCase()}` : "No spec sheet")}
      {chip(r.has3d, "3D", r.has3d ? "3D model assigned" : "3D generated from layout")}
      {chip(r.products > 0, `Protection${r.products ? ` ${r.products}` : ""}`, `${r.products} fitting products`)}
    </span>
  );
}

function toCsv(rows: InsightRow[]) {
  const esc = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["category", "brand", "series", "model", "slug", "release_year", "live", "popular", "photo", "spec_sheet", "3d_model", "own_repair_prices", "protection_products", "custom_designs", "bookings"];
  const body = rows.map((r) =>
    [r.categoryName, r.brandName, r.series, r.name, r.slug, r.releaseYear, live(r), r.popular, !!r.imageMediaId, r.specStatus ?? "", r.has3d, r.estimates, r.products, r.designs, r.bookings].map(esc).join(","),
  );
  return [head.join(","), ...body].join("\n");
}

export function DeviceInsights({ rows, categories }: { rows: InsightRow[]; categories: CatalogOption[] }) {
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState<Missing>("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [sort, setSort] = useState<"default" | "bookings" | "newest" | "name">("default");
  const storedView = useSyncExternalStore(subscribeView, readView, () => "blocks" as View);
  const [chosenView, setChosenView] = useState<View | null>(null);
  const view = chosenView ?? storedView;
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<InsightRow | null>(null);
  const [adding, setAdding] = useState<"" | "one" | "bulk">("");

  const changeView = (v: View) => {
    setChosenView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const total = rows.length;
  const coverage = useMemo(
    () => ({
      photos: rows.filter((r) => r.imageMediaId).length,
      prices: rows.filter((r) => r.estimates > 0).length,
      specs: rows.filter((r) => r.hasSpec).length,
      models3d: rows.filter((r) => r.has3d).length,
      protection: rows.filter((r) => r.products > 0).length,
      bookings: rows.reduce((n, r) => n + r.bookings, 0),
      brands: new Set(rows.map(brandKey)).size,
    }),
    [rows],
  );

  const categoryGroups = useMemo(() => {
    const cats = new Map<string, { slug: string; name: string; rows: InsightRow[] }>();
    for (const r of rows) {
      const c = cats.get(r.categorySlug) ?? { slug: r.categorySlug, name: r.categoryName, rows: [] };
      c.rows.push(r);
      cats.set(r.categorySlug, c);
    }
    return [...cats.values()].map((c) => {
      const brands = new Map<string, { key: string; slug: string; name: string; rows: InsightRow[] }>();
      for (const r of c.rows) {
        const b = brands.get(brandKey(r)) ?? { key: brandKey(r), slug: r.brandSlug, name: r.brandName, rows: [] };
        b.rows.push(r);
        brands.set(brandKey(r), b);
      }
      return {
        ...c,
        photos: c.rows.filter((r) => r.imageMediaId).length,
        bookings: c.rows.reduce((n, r) => n + r.bookings, 0),
        brands: [...brands.values()]
          .map((b) => ({ ...b, photos: b.rows.filter((r) => r.imageMediaId).length, bookings: b.rows.reduce((n, r) => n + r.bookings, 0) }))
          .sort((a, b) => b.rows.length - a.rows.length),
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = rows.filter(
      (r) =>
        (!category || r.categorySlug === category) &&
        (!brand || brandKey(r) === brand) &&
        (!missing || MISSING[missing].test(r)) &&
        (!status || (status === "active") === live(r)) &&
        words.every((w) => `${r.brandName} ${r.name} ${r.series ?? ""}`.toLowerCase().includes(w)),
    );
    if (sort === "bookings") out.sort((a, b) => b.bookings - a.bookings);
    if (sort === "newest") out.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
    if (sort === "name") out.sort((a, b) => `${a.brandName} ${a.name}`.localeCompare(`${b.brandName} ${b.name}`));
    return out;
  }, [rows, category, brand, q, missing, status, sort]);
  const topBooked = useMemo(() => [...rows].filter((r) => r.bookings > 0).sort((a, b) => b.bookings - a.bookings).slice(0, 8), [rows]);
  const brandOptions = categoryGroups.filter((c) => !category || c.slug === category).flatMap((c) => c.brands.map((b) => ({ key: b.key, label: category ? b.name : `${b.name} · ${c.name}` })));

  const pick = (fn: () => void) => {
    fn();
    setLimit(PAGE);
  };
  const showBrand = (cat: string, key: string) => {
    pick(() => (setCategory(cat), setBrand(key)));
    document.getElementById("device-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "devices.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total} devices · {coverage.brands} brands · {categoryGroups.length} categories
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAdding("bulk")}>
            Bulk add
          </Button>
          <Button onClick={() => setAdding("one")}>+ Add device</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Photos" value={coverage.photos} of={total} hint="One photo, used across the site" />
        <StatCard label="Own repair prices" value={coverage.prices} of={total} hint="Others use category defaults" />
        <StatCard label="Spec sheets" value={coverage.specs} of={total} />
        <StatCard label="3D models" value={coverage.models3d} of={total} hint="Others are generated" />
        <StatCard label="Protection" value={coverage.protection} of={total} hint="With fitting products" />
        <StatCard label="Bookings" value={coverage.bookings} hint="All time" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="By category" description="Click a row to filter the brands and devices below." />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 text-right font-medium">Brands</th>
                  <th className="px-2 py-2 text-right font-medium">Devices</th>
                  <th className="w-40 px-2 py-2 font-medium">Photos</th>
                  <th className="px-4 py-2 text-right font-medium">Bookings</th>
                </tr>
              </thead>
              <tbody>
                {categoryGroups.map((c) => (
                  <tr
                    key={c.slug}
                    onClick={() => pick(() => (setCategory(category === c.slug ? "" : c.slug), setBrand("")))}
                    className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted", category === c.slug && "bg-surface-muted font-semibold")}
                  >
                    <td className="px-4 py-2.5">{c.name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.brands.length}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.rows.length}</td>
                    <td className="px-2 py-2.5">
                      <Meter value={c.photos} of={c.rows.length} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Most booked" description="Devices with the most repair bookings." />
          <CardBody>
            {topBooked.length === 0 ? (
              <p className="text-sm text-muted">No bookings yet.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topBooked.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-muted tabular-nums">{i + 1}</span>
                    <Link href={`/admin/devices/${r.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {r.brandName} {r.name}
                      <span className="ml-1 text-xs text-muted">· {r.categoryName}</span>
                    </Link>
                    <span className="font-semibold tabular-nums">{r.bookings}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Brands by category" description="How filled each brand is: devices listed and how many have a photo. Click a brand to see its devices." />
        <CardBody className="space-y-6">
          {categoryGroups
            .filter((c) => !category || c.slug === category)
            .map((c) => (
              <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
                <h3 id={`cat-${c.slug}`} className="mb-2 text-sm font-semibold">
                  {c.name} <span className="font-normal text-muted">· {c.rows.length} devices</span>
                </h3>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {c.brands.map((b) => (
                    <li key={b.key}>
                      <button
                        type="button"
                        onClick={() => showBrand(c.slug, b.key)}
                        className={cn(
                          "flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-left transition hover:border-foreground/40",
                          brand === b.key ? "border-primary ring-2 ring-primary" : "border-border bg-surface",
                        )}
                      >
                        <span className="flex h-7 items-center">
                          <BrandLogo slug={b.slug} name={b.name} scale={0.6} max={24} fallbackClassName="text-sm font-bold" />
                        </span>
                        <span className="text-xs text-muted">
                          {b.rows.length} {b.rows.length === 1 ? "device" : "devices"} · {b.bookings} {b.bookings === 1 ? "booking" : "bookings"}
                        </span>
                        <Meter value={b.photos} of={b.rows.length} />
                        <span className={cn("text-xs", b.photos === 0 ? "font-medium text-danger" : "text-muted")}>
                          {b.photos === 0 ? "No photos yet" : `${b.photos} of ${b.rows.length} with photo`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </CardBody>
      </Card>

      <Card id="device-list" className="scroll-mt-20">
        <CardHeader
          title="Devices"
          description={`Showing ${Math.min(limit, filtered.length)} of ${filtered.length} matching (${total} listed).`}
          action={
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border p-0.5 text-sm" role="group" aria-label="View">
                {(["blocks", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => changeView(v)}
                    className={cn("rounded-md px-3 py-1", view === v ? "bg-primary font-medium text-primary-foreground" : "text-muted hover:text-foreground")}
                  >
                    {v === "blocks" ? "Blocks" : "List"}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))]">
            <Input className="sm:col-span-2 lg:col-span-3 2xl:col-span-1" type="search" placeholder="Search brand, series or model" value={q} onChange={(e) => pick(() => setQ(e.target.value))} aria-label="Search devices" />
            <Select value={category} onChange={(e) => pick(() => (setCategory(e.target.value), setBrand("")))} aria-label="Category">
              <option value="">All categories</option>
              {categoryGroups.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={brand} onChange={(e) => pick(() => setBrand(e.target.value))} aria-label="Brand">
              <option value="">All brands</option>
              {[...brandOptions]
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
            </Select>
            <Select value={missing} onChange={(e) => pick(() => setMissing(e.target.value as Missing))} aria-label="Missing">
              <option value="">Anything missing?</option>
              {Object.entries(MISSING).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => pick(() => setStatus(e.target.value as typeof status))} aria-label="Status">
              <option value="">Any status</option>
              <option value="active">Live</option>
              <option value="inactive">Hidden</option>
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
              <option value="default">Sort: brand</option>
              <option value="bookings">Most booked</option>
              <option value="newest">Newest</option>
              <option value="name">A–Z</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-border px-3 py-8 text-center text-sm text-muted">No devices match these filters.</p>
          ) : view === "blocks" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.slice(0, limit).map((r) => (
                <li key={r.id} className={cn("flex flex-col rounded-xl border border-border bg-surface", !live(r) && "opacity-60")}>
                  <Link href={`/admin/devices/${r.id}`} className="group flex flex-1 flex-col p-3">
                    <span className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                      {r.imageMediaId ? (
                        // eslint-disable-next-line @next/next/no-img-element -- media route thumbnail
                        <img src={mediaUrl(r.imageMediaId)} alt="" loading="lazy" className="max-h-full max-w-full object-contain transition group-hover:scale-105" />
                      ) : (
                        <span className="text-xs text-muted">No photo</span>
                      )}
                    </span>
                    <span className="mt-2 line-clamp-2 text-sm font-semibold group-hover:underline">
                      {r.brandName} {r.name}
                    </span>
                    <span className="text-xs text-muted">
                      {[r.series ?? r.categoryName, r.releaseYear].filter(Boolean).join(" · ")}
                    </span>
                    <SectionChips r={r} className="mt-2" />
                    <span className="mt-2 text-xs text-muted">
                      {r.bookings} {r.bookings === 1 ? "booking" : "bookings"}
                      {r.popular ? " · Popular" : ""}
                      {!live(r) ? " · Hidden" : ""}
                    </span>
                  </Link>
                  <div className="border-t border-border p-2">
                    <Button variant="ghost" size="sm" block onClick={() => setEditing(r)}>
                      Quick edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border rounded-[var(--radius)] border border-border">
              {filtered.slice(0, limit).map((r) => (
                <li key={r.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm sm:flex-nowrap", !live(r) && "opacity-60")}>
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                    {r.imageMediaId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media route thumbnail
                      <img src={mediaUrl(r.imageMediaId)} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted">No photo</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/admin/devices/${r.id}`} className="block truncate font-medium hover:underline">
                      {r.brandName} {r.name}
                    </Link>
                    <span className="block text-xs text-muted">{[r.categoryName, r.series, r.releaseYear].filter(Boolean).join(" · ")}</span>
                  </span>
                  <SectionChips r={r} className="hidden md:flex" />
                  <span className="w-20 text-right text-xs text-muted tabular-nums">
                    {r.bookings} {r.bookings === 1 ? "booking" : "bookings"}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {filtered.length > limit && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({filtered.length - limit} left)
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {editing && <EditDevice key={editing.id} row={editing} onClose={() => setEditing(null)} />}
      {adding === "one" && <AddDeviceDialog open categories={categories} onClose={() => setAdding("")} />}
      {adding === "bulk" && <BulkAddDialog open categories={categories} onClose={() => setAdding("")} />}
    </div>
  );
}

/** Quick edit from the list: name, year, live, popular and photo. Everything else is on the device page. */
export function EditDevice({ row, onClose }: { row: Pick<InsightRow, "id" | "name" | "brandId" | "brandName" | "categoryName" | "releaseYear" | "active" | "popular" | "imageMediaId" | "bookings">; onClose: () => void }) {
  const { run, pending, error } = useAction();
  const [imageMediaId, setImageMediaId] = useState(row.imageMediaId);
  return (
    <Dialog open onClose={onClose} title={`${row.brandName} ${row.name}`} description={`${row.categoryName} · ${row.bookings} bookings`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const year = String(f.get("releaseYear") ?? "").trim();
          run(
            () =>
              upsertModelAction({
                id: row.id,
                brandId: row.brandId,
                name: f.get("name"),
                active: f.get("active") === "on",
                popular: f.get("popular") === "on",
                releaseYear: year ? Number(year) : null,
                imageMediaId,
              }),
            onClose,
          );
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Model name" hint="Renaming changes the device's web address." required>
          {(p) => <Input {...p} name="name" defaultValue={row.name} maxLength={80} />}
        </Field>
        <Field label="Release year">{(p) => <Input {...p} name="releaseYear" type="number" min={2000} max={2100} defaultValue={row.releaseYear ?? ""} />}</Field>
        <div className="flex flex-wrap gap-4">
          <Checkbox name="active" label="Live in booking" defaultChecked={row.active} />
          <Checkbox name="popular" label="Popular (shown first)" defaultChecked={row.popular} />
        </div>
        <ImageUpload value={imageMediaId} onChange={setImageMediaId} purpose="DEVICE_IMAGE" label="Product photo" />
        <p className="text-xs text-muted">One photo per device: it shows on repair pages, the booking picker, the studio and the spec sheet. Transparent or white background works best.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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

