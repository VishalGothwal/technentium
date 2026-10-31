import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { getActor } from "@/server/auth/session";
import { getCart } from "@/server/modules/shop/cart.service";
import { cartIdentity } from "@/server/modules/shop/cart-session";
import { checkoutDefaults } from "@/server/modules/shop/request.service";
import { formatPaise } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Alert, PageSkeleton } from "@/components/ui/surface";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { ProductVisual } from "@/components/shop/product-visual";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("checkout.title"), robots: { index: false } };
}

export default async function CheckoutPage() {
  const { t, locale } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/${locale}/protection/cart`} className="text-sm text-muted hover:text-foreground">
        ← {t("checkout.backToCart")}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("checkout.title")}</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Checkout />
      </Suspense>
    </div>
  );
}

async function Checkout() {
  const { t, locale } = await getT();
  const actor = await getActor();
  const cart = await getCart(await cartIdentity(actor));

  if (cart.items.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-lg font-semibold">{t("cart.empty")}</p>
        <ButtonLink href={`/${locale}/protection/products`} className="mt-5 rounded-xl">
          {t("cart.browse")}
        </ButtonLink>
      </div>
    );
  }

  const summary = (
    <aside aria-labelledby="checkout-summary" className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-3xl border border-border bg-surface p-5">
        <h2 id="checkout-summary" className="font-semibold">
          {t("cart.summary")}
        </h2>
        <ul className="mt-4 space-y-3">
          {cart.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 text-sm">
              <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                <ProductVisual imageId={i.imageId} categorySlug={i.categorySlug} />
                <span className="absolute -top-0 -right-0 rounded-bl-lg bg-foreground px-1.5 text-[11px] font-bold text-white">×{i.quantity}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2">{localized(locale, i.nameEn, i.nameHi)}</span>
                {i.device && <span className="block text-xs text-muted">{t("shop.forDevice", { device: i.device.name })}</span>}
              </span>
              <span className="font-medium">{formatPaise(i.lineTotalPaise, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.subtotal")}</dt>
            <dd className="font-medium">{formatPaise(cart.subtotalPaise, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.shipping")}</dt>
            <dd>{t("cart.shippingTbd")}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );

  if (!actor) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-3xl border border-border bg-surface p-6">
          <h2 className="text-xl font-semibold">{t("checkout.signInTitle")}</h2>
          <p className="mt-2 text-muted">{t("checkout.signInBody")}</p>
          <ButtonLink href={`/${locale}/auth/sign-in?next=${encodeURIComponent(`/${locale}/protection/checkout`)}`} size="lg" className="mt-5 rounded-xl">
            {t("checkout.signIn")}
          </ButtonLink>
        </div>
        {summary}
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        {cart.hasUnavailable ? <Alert tone="warning">{t("cart.hasUnavailable")}</Alert> : <CheckoutForm defaults={await checkoutDefaults(actor)} />}
      </div>
      {summary}
    </div>
  );
}
