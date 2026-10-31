import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { can } from "@/server/rbac/actor";
import { getProductRequestForStaff } from "@/server/modules/shop/request.service";
import { staffTargets } from "@/server/modules/shop/order-state";
import { createT } from "@/i18n/translate";
import { formatDateTime, formatPaise } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { ORDER_TONE } from "@/components/shop/order-status";
import { NoteForm, OrderActions } from "./order-actions";

export const metadata = { title: "Product request" };
export const instant = false;

const t = createT("en");

export default async function OrderDetailAdminPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const actor = await requireStaffPage();
  if (!can(actor, "product_request.manage")) return <NoAccess />;
  let r;
  try {
    r = await getProductRequestForStaff(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const subtotalConfirmed = r.items.reduce((n, i) => n + i.unitPricePaise * (i.confirmedQuantity ?? i.quantity), 0);

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-sm text-muted hover:text-foreground">
        ← Product requests
      </Link>
      <PageHeader
        title={r.reference}
        description={`Requested ${formatDateTime(r.createdAt)} · last updated ${formatDateTime(r.updatedAt)}`}
        actions={
          <Badge tone={ORDER_TONE[r.status]} className="text-sm">
            {t(`orders.status.${r.status}`)}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Items" description="Prices are fixed at the time of the request." />
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted text-left text-muted">
                  <tr>
                    {["Product", "Device", "Unit", "Requested", "Confirmed", "In stock", "Line"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((i) => {
                    const onHand = i.product.inventory?.onHand;
                    const need = i.confirmedQuantity ?? i.quantity;
                    return (
                      <tr key={i.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2">
                          <Link href={`/admin/products/${i.product.id}`} className="font-medium hover:underline">
                            {i.nameSnapshot}
                          </Link>
                          <span className="block text-xs text-muted">{i.skuSnapshot}</span>
                        </td>
                        <td className="px-3 py-2">{i.deviceModel ? `${i.deviceModel.brand.name} ${i.deviceModel.name}` : <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">{formatPaise(i.unitPricePaise)}</td>
                        <td className="px-3 py-2">{i.quantity}</td>
                        <td className="px-3 py-2">{i.confirmedQuantity ?? <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2">
                          {onHand === undefined ? <span className="text-muted">n/a</span> : <span className={onHand < need ? "font-semibold text-danger" : ""}>{onHand}</span>}
                        </td>
                        <td className="px-3 py-2 font-medium">{formatPaise(i.unitPricePaise * need)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardBody>
            <CardBody className="border-t border-border">
              <DescriptionList
                items={[
                  ["Requested subtotal", formatPaise(r.subtotalPaise)],
                  ["Confirmed subtotal", r.totalPaise !== null ? formatPaise(subtotalConfirmed) : "—"],
                  ["Shipping", r.shippingPaise !== null ? formatPaise(r.shippingPaise) : "Not set"],
                  ["Total", r.totalPaise !== null ? <strong key="t">{formatPaise(r.totalPaise)}</strong> : "Set on confirmation"],
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes & communication" description="Customer-visible notes appear on the customer's order page and send a notification." />
            <CardBody className="space-y-4">
              {r.notes.length === 0 ? (
                <p className="text-sm text-muted">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {r.notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="font-medium text-foreground">{r.names[n.authorId] ?? "Staff"}</span>
                        <span>{formatDateTime(n.createdAt)}</span>
                        <Badge tone={n.visibility === "CUSTOMER" ? "info" : "neutral"}>{n.visibility === "CUSTOMER" ? "Customer-visible" : "Internal"}</Badge>
                      </div>
                      <p className="whitespace-pre-line">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <NoteForm requestId={r.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody>
              <ol className="space-y-2 text-sm">
                {r.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{h.fromStatus ? `${t(`orders.status.${h.fromStatus}`)} → ` : ""}{t(`orders.status.${h.toStatus}`)}</span>
                    <span className="text-muted">
                      {r.names[h.actorId ?? ""] ?? "System"} · {formatDateTime(h.createdAt)}
                    </span>
                    {h.reason && <span className="w-full text-muted">“{h.reason}”</span>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <OrderActions
            requestId={r.id}
            status={r.status}
            targets={staffTargets(r.status)}
            items={r.items.map((i) => ({ id: i.id, name: i.nameSnapshot, quantity: i.quantity, unitPricePaise: i.unitPricePaise, onHand: i.product.inventory?.onHand ?? null }))}
          />
          <Card>
            <CardHeader title="Customer & delivery" />
            <CardBody className="text-sm">
              <DescriptionList
                items={[
                  ["Contact", r.contactName],
                  ["Phone", <a key="p" href={`tel:${r.contactPhone}`} className="text-primary hover:underline">{r.contactPhone}</a>],
                  ["Account", <Link key="a" href={`/admin/customers/${r.customer.id}`} className="text-primary hover:underline">{r.customer.name}</Link>],
                  ["Address", <span key="ad" className="whitespace-pre-line">{[r.addressLine1, r.addressLine2, `${r.city}, ${r.state} ${r.pincode}`].filter(Boolean).join("\n")}</span>],
                  ["Customer notes", r.customerNotes ?? "—"],
                  ["Tracking", r.trackingInfo ?? "—"],
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
