import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { requireCustomerPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getMyProductRequest } from "@/server/modules/shop/request.service";
import { formatDateTime, formatPaise } from "@/lib/format";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { ORDER_TONE, OrderTimeline } from "@/components/shop/order-status";
import { ProductVisual } from "@/components/shop/product-visual";
import { CancelOrderButton } from "./cancel-button";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/account/orders/[reference]">): Promise<Metadata> {
  const { reference } = await params;
  return { title: reference, robots: { index: false } };
}

export default async function OrderDetailPage({ params }: PageProps<"/[locale]/account/orders/[reference]">) {
  const { reference } = await params;
  const { t, locale } = await getT();
  const actor = await requireCustomerPage(locale, `/${locale}/account/orders/${reference}`);
  let order;
  try {
    order = await getMyProductRequest(actor, reference);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const ended = order.status === "DECLINED" || order.status === "CANCELLED";
  const endReason = [...order.history].reverse().find((h) => h.toStatus === order.status)?.reason;
  const confirmedish = order.totalPaise !== null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {t("orders.reference")} {order.reference}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-sm text-muted">{t("orders.lastUpdated", { date: formatDateTime(order.updatedAt, locale) })}</p>
        </div>
        <Badge tone={ORDER_TONE[order.status]} className="text-sm">
          {t(`orders.status.${order.status}`)}
        </Badge>
      </div>

      {order.status === "SUBMITTED" && <Alert tone="info">{t("orders.requestNotice")}</Alert>}
      {order.status === "DECLINED" && (
        <Alert tone="danger" title={t("orders.declinedTitle")}>
          {endReason}
        </Alert>
      )}
      {order.status === "CANCELLED" && (
        <Alert tone="neutral" title={t("orders.cancelledTitle")}>
          {endReason}
        </Alert>
      )}

      {!ended && (
        <Card className="p-5">
          <h2 className="mb-5 font-semibold">{t("orders.timeline")}</h2>
          <div aria-live="polite">
            <OrderTimeline status={order.status} history={order.history} t={t} locale={locale} />
          </div>
        </Card>
      )}

      {order.trackingInfo && (
        <Card className="border-info/30 bg-info-soft p-5">
          <h2 className="font-semibold">{t("orders.tracking")}</h2>
          <p className="mt-1 whitespace-pre-line">{order.trackingInfo}</p>
        </Card>
      )}

      {order.notes.length > 0 && (
        <Card>
          <CardHeader title={t("orders.updates")} />
          <CardBody>
            <ul className="space-y-3">
              {order.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-surface-muted p-3 text-sm">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={t("orders.itemsTitle")} />
        <CardBody>
          <ul className="divide-y divide-border">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted" aria-hidden>
                  <ProductVisual imageId={i.product.images[0]?.mediaId ?? null} categorySlug={i.product.category.slug} />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <Link href={`/${locale}/protection/${i.product.slug}`} className="font-medium hover:underline">
                    {localized(locale, i.nameSnapshot, i.product.nameHi)}
                  </Link>
                  {i.deviceModel && <span className="block text-xs text-muted">{t("orders.forDevice", { device: `${i.deviceModel.brand.name} ${i.deviceModel.name}` })}</span>}
                  <span className="block text-muted">
                    {i.confirmedQuantity !== null && i.confirmedQuantity !== i.quantity
                      ? t("orders.confirmedQty", { qty: i.confirmedQuantity, requested: i.quantity })
                      : t("orders.qty", { qty: i.quantity })}{" "}
                    · {formatPaise(i.unitPricePaise, locale)}
                  </span>
                </span>
                <span className="text-sm font-semibold">{formatPaise(i.unitPricePaise * (i.confirmedQuantity ?? i.quantity), locale)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t("orders.subtotal")}</dt>
              <dd>{formatPaise(confirmedish ? (order.totalPaise ?? 0) - (order.shippingPaise ?? 0) : order.subtotalPaise, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("orders.shipping")}</dt>
              <dd>{order.shippingPaise !== null ? formatPaise(order.shippingPaise, locale) : t("orders.shippingPending")}</dd>
            </div>
            <div className="flex justify-between text-base">
              <dt className="font-semibold">{t("orders.total")}</dt>
              <dd className="font-bold">{order.totalPaise !== null ? formatPaise(order.totalPaise, locale) : t("orders.totalPending")}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5 text-sm">
          <h2 className="font-semibold">{t("orders.deliverTo")}</h2>
          <address className="mt-2 not-italic text-muted">
            {order.contactName}
            <br />
            {order.addressLine1}
            {order.addressLine2 && (
              <>
                <br />
                {order.addressLine2}
              </>
            )}
            <br />
            {order.city}, {order.state} {order.pincode}
            <br />
            {order.contactPhone}
          </address>
          {order.customerNotes && (
            <>
              <h3 className="mt-4 font-semibold">{t("orders.yourNotes")}</h3>
              <p className="mt-1 whitespace-pre-line text-muted">{order.customerNotes}</p>
            </>
          )}
        </Card>
        <Card className="p-5 text-sm">
          <h2 className="font-semibold">{t("orders.activity")}</h2>
          <ol className="mt-2 space-y-2">
            {order.history.map((h, idx) => (
              <li key={idx}>
                <span className="font-medium">{t(`orders.status.${h.toStatus}`)}</span> <span className="text-muted">· {formatDateTime(h.createdAt, locale)}</span>
                {h.reason && h.toStatus !== "DECLINED" && h.toStatus !== "CANCELLED" && <p className="text-muted">{h.reason}</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {order.status === "SUBMITTED" && <CancelOrderButton reference={order.reference} />}
    </div>
  );
}
