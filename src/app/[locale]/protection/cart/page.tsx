import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { getActor } from "@/server/auth/session";
import { getCart } from "@/server/modules/shop/cart.service";
import { cartIdentity } from "@/server/modules/shop/cart-session";
import { formatPaise } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Alert, PageSkeleton } from "@/components/ui/surface";
import { CartLines } from "@/components/shop/cart-lines";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("cart.title"), robots: { index: false, follow: true } };
}

export default async function CartPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("cart.title")}</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Cart />
      </Suspense>
    </div>
  );
}

async function Cart() {
  const { t, locale } = await getT();
  const cart = await getCart(await cartIdentity(await getActor()));

  if (cart.items.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-lg font-semibold">{t("cart.empty")}</p>
        <p className="mt-1 text-sm text-muted">{t("cart.emptyBody")}</p>
        <ButtonLink href={`/${locale}/protection/products`} className="mt-5 rounded-xl">
          {t("cart.browse")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-4">
        {cart.hasUnavailable && <Alert tone="warning">{t("cart.hasUnavailable")}</Alert>}
        <CartLines items={cart.items} />
        <ButtonLink href={`/${locale}/protection/products`} variant="link">
          ← {t("cart.continue")}
        </ButtonLink>
      </div>
      <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border border-border bg-surface p-5">
          <h2 id="summary-title" className="text-lg font-semibold">
            {t("cart.summary")}
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">
                {t("cart.subtotal")} · {t("cart.items", { count: cart.count })}
              </dt>
              <dd className="font-medium">{formatPaise(cart.subtotalPaise, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("cart.shipping")}</dt>
              <dd className="text-right">{t("cart.shippingTbd")}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-semibold">{t("cart.total")}</dt>
              <dd className="font-bold">{formatPaise(cart.subtotalPaise, locale)}</dd>
            </div>
          </dl>
          {cart.hasUnavailable ? (
            <p className="mt-5 rounded-xl bg-surface-muted p-3 text-center text-sm text-muted">{t("cart.hasUnavailable")}</p>
          ) : (
            <ButtonLink href={`/${locale}/protection/checkout`} size="lg" block className="mt-5 rounded-xl">
              {t("cart.checkout")}
            </ButtonLink>
          )}
          <p className="mt-3 text-xs text-muted">{t("cart.noPayNote")}</p>
        </div>
      </aside>
    </div>
  );
}
