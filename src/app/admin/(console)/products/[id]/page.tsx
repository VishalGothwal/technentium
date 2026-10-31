import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { getProductAdmin, listCategoriesAdmin } from "@/server/modules/shop/product-admin.service";
import { formatDateTime, formatPaise } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { ProductForm } from "../product-form";
import { StockPanel } from "./stock-panel";

export const metadata = { title: "Product" };
export const instant = false;

const paiseToRupees = (p: number | null) => (p === null ? "" : (p / 100).toFixed(p % 100 === 0 ? 0 : 2));
const REASON_LABEL = { RECEIVED: "Received", ADJUSTMENT: "Adjustment", REQUEST_FULFILLED: "Order fulfilled", RETURNED: "Returned", DAMAGED: "Damaged" } as const;

export default async function ProductAdminPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const actor = await requireStaffPage();
  if (!can(actor, "product.manage") && !can(actor, "inventory.manage")) return <NoAccess />;
  let p;
  try {
    p = await getProductAdmin(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const categories = await listCategoriesAdmin(actor);
  const canEdit = can(actor, "product.manage");
  const low = p.onHand <= p.lowStockThreshold;

  return (
    <div className="space-y-5">
      <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
        ← Products
      </Link>
      <PageHeader
        title={p.nameEn}
        description={`${p.sku} · ${p.category.nameEn} · updated ${formatDateTime(p.updatedAt)}`}
        actions={
          p.status === "ACTIVE" ? (
            <ButtonLink href={`/en/protection/${p.slug}`} variant="secondary" size="sm" target="_blank">
              View in store ↗
            </ButtonLink>
          ) : (
            <Badge tone="warning">{p.status.toLowerCase()} — not visible in store</Badge>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div>
          {canEdit ? (
            <ProductForm
              productId={p.id}
              categories={categories.filter((c) => c.active || c.id === p.categoryId)}
              initial={{
                slug: p.slug,
                sku: p.sku,
                nameEn: p.nameEn,
                nameHi: p.nameHi ?? "",
                summaryEn: p.summaryEn ?? "",
                summaryHi: p.summaryHi ?? "",
                descriptionEn: p.descriptionEn ?? "",
                descriptionHi: p.descriptionHi ?? "",
                categoryId: p.categoryId,
                typeId: p.typeId ?? "",
                price: paiseToRupees(p.pricePaise),
                mrp: paiseToRupees(p.mrpPaise),
                status: p.status,
                featured: p.featured,
                universal: p.universal,
                lowStockThreshold: String(p.lowStockThreshold),
                specs: p.specs.map((s) => ({ labelEn: s.labelEn, labelHi: s.labelHi ?? "", value: s.value })),
                imageIds: p.images.map((i) => i.mediaId),
                compat: p.compatibility.map((c) => ({ id: c.deviceModel.id, label: `${c.deviceModel.brand.name} ${c.deviceModel.name}` })),
                seoTitle: p.seoTitle ?? "",
                metaDescription: p.metaDescription ?? "",
              }}
            />
          ) : (
            <Card>
              <CardHeader title="Product details" description="Your role can manage stock but not edit product details." />
              <CardBody>
                <DescriptionList
                  items={[
                    ["Price", formatPaise(p.pricePaise)],
                    ["Status", p.status.toLowerCase()],
                    ["Compatible models", p.universal ? "Universal" : String(p.compatibility.length)],
                  ]}
                />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Stock" description={`Low-stock threshold: ${p.lowStockThreshold}`} />
            <CardBody className="space-y-4">
              <p className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${p.onHand === 0 ? "text-danger" : low ? "text-warning" : ""}`}>{p.onHand}</span>
                <span className="text-muted">on hand</span>
                {low && <Badge tone={p.onHand === 0 ? "danger" : "warning"}>{p.onHand === 0 ? "Out of stock" : "Low stock"}</Badge>}
              </p>
              {can(actor, "inventory.manage") ? <StockPanel productId={p.id} /> : <p className="text-sm text-muted">Stock adjustments need the inventory role.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Stock history" description="Last 50 movements" />
            <CardBody>
              {p.movements.length === 0 ? (
                <p className="text-sm text-muted">No movements yet.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {p.movements.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                      <span>
                        <span className="font-medium">{REASON_LABEL[m.reason]}</span>
                        <span className="block text-xs text-muted">
                          {p.names[m.actorId] ?? (m.actorId === "seed" ? "Opening stock" : "Staff")} · {formatDateTime(m.createdAt)}
                        </span>
                        {m.note && <span className="block text-xs text-muted">{m.note}</span>}
                      </span>
                      <span className="text-right">
                        <span className={`font-semibold ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                        <span className="block text-xs text-muted">→ {m.balance}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
