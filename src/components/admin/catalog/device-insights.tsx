"use client";
import { useMemo, useState } from "react";
import { upsertModelAction } from "@/app/admin/actions";
import { useAction } from "@/components/admin/use-action";
import { ImageUpload } from "@/components/admin/content/media-upload";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";

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
  bookings: number;
};

type Stats = { models: number; active: number; photos: number; specs: number; bookings: number; brands: number };
const PAGE = 100;

function stats(rows: InsightRow[]): Stats {
  return {
    models: rows.length,
    active: rows.filter((r) => r.active && r.brandActive).length,
    photos: rows.filter((r) => r.imageMediaId).length,
    specs: rows.filter((r) => r.hasSpec).length,
    bookings: rows.reduce((n, r) => n + r.bookings, 0),
    brands: new Set(rows.map((r) => `${r.categorySlug}/${r.brandSlug}`)).size,
  };
}
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

function Meter({ value, of }: { value: number; of: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct(value, of)}%` }} />
      </span>
      <span className="tabular-nums">{pct(value, of)}%</span>
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function toCsv(rows: InsightRow[]) {
  const esc = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["category", "brand", "series", "model", "slug", "release_year", "active", "popular", "photo", "spec_sheet", "bookings"];
  const body = rows.map((r) => [r.categoryName, r.brandName, r.series, r.name, r.slug, r.releaseYear, r.active && r.brandActive, r.popular, !!r.imageMediaId, r.hasSpec, r.bookings].map(esc).join(","));
  return [head.join(","), ...body].join("\n");
}

export function DeviceInsights({ rows }: { rows: InsightRow[] }) {
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [q, setQ] = useState("");
  const [photo, setPhoto] = useState<"" | "with" | "missing">("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [sort, setSort] = useState<"default" | "bookings" | "newest" | "name">("default");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<InsightRow | null>(null);

  const total = useMemo(() => stats(rows), [rows]);
  const categories = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; rows: InsightRow[] }>();
    for (const r of rows) {
      const c = map.get(r.categorySlug) ?? { slug: r.categorySlug, name: r.categoryName, rows: [] };
      c.rows.push(r);
      map.set(r.categorySlug, c);
    }
    return [...map.values()].map((c) => ({ ...c, stats: stats(c.rows) }));
  }, [rows]);
  const brandsInScope = useMemo(() => {
    const map = new Map<string, { key: string; name: string; rows: InsightRow[] }>();
    for (const r of rows) {
      if (category && r.categorySlug !== category) continue;
      const key = category ? r.brandSlug : r.brandName;
      const b = map.get(key) ?? { key, name: r.brandName, rows: [] };
      b.rows.push(r);
      map.set(key, b);
    }
    return [...map.values()].map((b) => ({ ...b, stats: stats(b.rows) })).sort((a, b) => b.stats.models - a.stats.models);
  }, [rows, category]);

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = rows.filter(
      (r) =>
        (!category || r.categorySlug === category) &&
        (!brand || (category ? r.brandSlug === brand : r.brandName === brand)) &&
        (!photo || (photo === "with" ? !!r.imageMediaId : !r.imageMediaId)) &&
        (!status || (status === "active") === (r.active && r.brandActive)) &&
        words.every((w) => `${r.brandName} ${r.name} ${r.series ?? ""}`.toLowerCase().includes(w)),
    );
    if (sort === "bookings") out.sort((a, b) => b.bookings - a.bookings);
    if (sort === "newest") out.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
    if (sort === "name") out.sort((a, b) => `${a.brandName} ${a.name}`.localeCompare(`${b.brandName} ${b.name}`));
    return out;
  }, [rows, category, brand, q, photo, status, sort]);
  const topBooked = useMemo(() => [...rows].filter((r) => r.bookings > 0).sort((a, b) => b.bookings - a.bookings).slice(0, 8), [rows]);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "devices.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }
  const pick = (fn: () => void) => {
    fn();
    setLimit(PAGE);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Devices listed" value={total.models} hint={`${categories.length} categories`} />
        <StatCard label="Brands" value={total.brands} />
        <StatCard label="Live in booking" value={total.active} hint={`${total.models - total.active} hidden`} />
        <StatCard label="With photo" value={`${pct(total.photos, total.models)}%`} hint={`${total.photos} of ${total.models}`} />
        <StatCard label="Spec sheets" value={total.specs} />
        <StatCard label="Bookings" value={total.bookings} hint="all time, listed devices" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="By category" description="Click a row to filter the list below." />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 text-right font-medium">Brands</th>
                  <th className="px-2 py-2 text-right font-medium">Devices</th>
                  <th className="px-2 py-2 text-right font-medium">Live</th>
                  <th className="px-2 py-2 font-medium">Photos</th>
                  <th className="px-4 py-2 text-right font-medium">Bookings</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr
                    key={c.slug}
                    onClick={() => pick(() => (setCategory(category === c.slug ? "" : c.slug), setBrand("")))}
                    className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted", category === c.slug && "bg-surface-muted font-semibold")}
                  >
                    <td className="px-4 py-2.5">{c.name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.stats.brands}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.stats.models}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.stats.active}</td>
                    <td className="px-2 py-2.5">
                      <Meter value={c.stats.photos} of={c.stats.models} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.stats.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Most booked" description="Listed devices with the most repair bookings." />
          <CardBody>
            {topBooked.length === 0 ? (
              <p className="text-sm text-muted">No bookings yet.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {topBooked.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-muted tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.brandName} {r.name}
                      <span className="ml-1 text-xs text-muted">· {r.categoryName}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{r.bookings}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={category ? `Brands in ${categories.find((c) => c.slug === category)?.name}` : "By brand (all categories)"} description="Click a brand to filter the list below." />
        <CardBody>
          <ul className="flex flex-wrap gap-2">
            {brandsInScope.map((b) => (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => pick(() => setBrand(brand === b.key ? "" : b.key))}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                    brand === b.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
                  )}
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="tabular-nums opacity-70">{b.stats.models}</span>
                  {b.stats.photos < b.stats.models && <span className="text-xs opacity-70">· {b.stats.models - b.stats.photos} no photo</span>}
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Devices"
          description={`Showing ${Math.min(limit, filtered.length)} of ${filtered.length} matching (${rows.length} listed).`}
          action={
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))]">
            <Input className="sm:col-span-2 lg:col-span-3 xl:col-span-1" type="search" placeholder="Search brand, series or model" value={q} onChange={(e) => pick(() => setQ(e.target.value))} aria-label="Search devices" />
            <Select value={category} onChange={(e) => pick(() => (setCategory(e.target.value), setBrand("")))} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={brand} onChange={(e) => pick(() => setBrand(e.target.value))} aria-label="Brand">
              <option value="">All brands</option>
              {[...brandsInScope]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name}
                  </option>
                ))}
            </Select>
            <Select value={photo} onChange={(e) => pick(() => setPhoto(e.target.value as typeof photo))} aria-label="Photo">
              <option value="">Photo: any</option>
              <option value="with">Has photo</option>
              <option value="missing">Missing photo</option>
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

          <ul className="divide-y divide-border rounded-[var(--radius)] border border-border">
            {filtered.slice(0, limit).map((r) => (
              <li key={r.id} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm", !(r.active && r.brandActive) && "opacity-60")}>
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                  {r.imageMediaId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- media route thumbnail
                    <img src={mediaUrl(r.imageMediaId)} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted">No photo</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.brandName} {r.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {r.categoryName}
                    {r.series ? ` · ${r.series}` : ""}
                    {r.releaseYear ? ` · ${r.releaseYear}` : ""}
                  </span>
                </span>
                <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                  {r.popular && <Badge tone="primary">Popular</Badge>}
                  {r.hasSpec && <Badge tone="info">Spec sheet</Badge>}
                  {!r.active && <Badge>Hidden</Badge>}
                  {r.active && !r.brandActive && <Badge>Brand hidden</Badge>}
                </span>
                <span className="w-16 text-right text-xs text-muted tabular-nums" title="Repair bookings">
                  {r.bookings} {r.bookings === 1 ? "booking" : "bookings"}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                  Edit
                </Button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No devices match these filters.</li>}
          </ul>
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
    </div>
  );
}

function EditDevice({ row, onClose }: { row: InsightRow; onClose: () => void }) {
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
        <p className="text-xs text-muted">Use a photo of the device on a transparent or white background (PNG works best).</p>
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
