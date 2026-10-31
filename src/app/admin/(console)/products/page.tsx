import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listCategoriesAdmin, listProductsAdmin, lowStockCount } from "@/server/modules/shop/product-admin.service";
import { formatDateTime, formatPaise } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";
import { ProductVisual } from "@/components/shop/product-visual";

export const metadata = { title: "Products & stock" };
export const instant = false;

const STATUS_TONE = { ACTIVE: "success", DRAFT: "warning", ARCHIVED: "neutral" } as const;
const STOCK_TONE = { in_stock: "success", low_stock: "warning", out_of_stock: "danger", unknown: "neutral" } as const;

export default async function ProductsAdminPage({ searchParams }: PageProps<"/admin/products">) {
  const actor = await requireStaffPage();
  if (!can(actor, "product.manage") && !can(actor, "inventory.manage")) return <NoAccess />;
  const sp = await searchParams;
  const q = strParam(sp.q)?.slice(0, 60);
  const statusRaw = strParam(sp.status);
  const status = statusRaw === "DRAFT" || statusRaw === "ACTIVE" || statusRaw === "ARCHIVED" || statusRaw === "ALL" ? statusRaw : undefined;
  const categoryId = strParam(sp.category);
  const lowStock = strParam(sp.low) === "1";
  const page = pageParam(sp.page);
  const [{ items, total, pageSize }, categories, lowCount] = await Promise.all([
    listProductsAdmin(actor, { q, status, categoryId, lowStock, page }),
    listCategoriesAdmin(actor),
    lowStockCount(actor),
  ]);
  const canEdit = can(actor, "product.manage");

  return (
    <>
      <PageHeader
        title="Products & stock"
        description="Protection products, device compatibility and inventory."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products/categories" variant="secondary" size="sm">
              Categories
            </ButtonLink>
            {canEdit && (
              <ButtonLink href="/admin/products/new" size="sm">
                New product
              </ButtonLink>
            )}
          </div>
        }
      />

      {lowCount > 0 && !lowStock && (
        <Link href="/admin/products?low=1" className="mb-4 flex items-center justify-between rounded-[var(--radius)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <span>
            <strong>{lowCount}</strong> active product{lowCount === 1 ? " is" : "s are"} at or below the low-stock threshold.
          </span>
          <span className="font-semibold">Review →</span>
        </Link>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Search</span>
          <input name="q" defaultValue={q} placeholder="Name, SKU or slug" className="h-10 w-64 rounded-lg border border-border bg-surface px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Status</span>
          <select name="status" defaultValue={status ?? ""} className="h-10 rounded-lg border border-border bg-surface px-3">
            <option value="">Active & draft</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Category</span>
          <select name="category" defaultValue={categoryId ?? ""} className="h-10 rounded-lg border border-border bg-surface px-3">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={lowStock} className="size-4" /> Low stock only
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No products match" description={canEdit ? "Create a product to start selling." : undefined} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted text-left text-muted">
                <tr>
                  {["Product", "Category", "Price", "Stock", "Fits", "Status", "Updated"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className={`border-b border-border/60 last:border-0 hover:bg-surface-muted/60 ${p.stock === "out_of_stock" || p.stock === "low_stock" ? "bg-warning-soft/40" : ""}`}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                          <ProductVisual imageId={p.images[0]?.mediaId ?? null} categorySlug={p.category.slug} />
                        </span>
                        <span>
                          <span className="block font-medium text-primary hover:underline">{p.nameEn}</span>
                          <span className="text-xs text-muted">{p.sku}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">{p.category.nameEn}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatPaise(p.pricePaise)}
                      {p.mrpPaise && <span className="ml-1 text-xs text-muted line-through">{formatPaise(p.mrpPaise)}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={STOCK_TONE[p.stock]}>
                        {p.onHand} {p.stock === "low_stock" ? "· low" : p.stock === "out_of_stock" ? "· out" : ""}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted">{p.universal ? "Universal" : p._count.compatibility ? `${p._count.compatibility} models` : <span className="text-warning">None mapped</span>}</td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                      {p.featured && <Badge tone="primary" className="ml-1">featured</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted">{formatDateTime(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/products" params={{ q, status, category: categoryId, low: lowStock ? "1" : undefined }} />
        </>
      )}
    </>
  );
}
