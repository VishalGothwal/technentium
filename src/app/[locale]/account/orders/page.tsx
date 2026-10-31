import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireCustomerPage } from "@/server/auth/guards";
import { listMyProductRequests } from "@/server/modules/shop/request.service";
import { formatDate, formatPaise } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { ORDER_TONE } from "@/components/shop/order-status";
import { ProductVisual } from "@/components/shop/product-visual";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("orders.title"), robots: { index: false } };
}

export default async function MyOrdersPage() {
  const { t, locale } = await getT();
  const orders = await listMyProductRequests(await requireCustomerPage(locale, `/${locale}/account/orders`));

  return (
    <>
      <PageHeader title={t("orders.title")} actions={<ButtonLink href={`/${locale}/protection/products`}>{t("orders.browse")}</ButtonLink>} />
      {orders.length === 0 ? (
        <EmptyState title={t("orders.empty")} description={t("orders.emptyBody")} action={<ButtonLink href={`/${locale}/protection`}>{t("orders.browse")}</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const count = o.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <li key={o.reference}>
                <Link
                  href={`/${locale}/account/orders/${o.reference}`}
                  className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-surface p-4 hover:border-primary/40"
                >
                  <span className="flex -space-x-3" aria-hidden>
                    {o.items.slice(0, 3).map((i, idx) => (
                      <span key={idx} className="size-12 overflow-hidden rounded-xl border-2 border-surface bg-surface-muted">
                        <ProductVisual imageId={i.product.images[0]?.mediaId ?? null} categorySlug={i.product.category.slug} />
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.items.map((i) => i.nameSnapshot).join(", ")}</span>
                    <span className="block text-sm text-muted">
                      {o.reference} · {t("orders.placedOn", { date: formatDate(o.createdAt, locale) })} · {t("orders.items", { count })}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={ORDER_TONE[o.status]}>{t(`orders.status.${o.status}`)}</Badge>
                    <span className="text-sm font-semibold">{formatPaise(o.totalPaise ?? o.subtotalPaise, locale)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
