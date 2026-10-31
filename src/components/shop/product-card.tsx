import Link from "next/link";
import type { TFunction } from "@/i18n/translate";
import { localized } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { discountPercent, type StockLevel } from "@/server/modules/shop/order-state";
import { ProductVisual } from "./product-visual";

type CardProduct = {
  slug: string;
  type?: { slug: string; nameEn: string; nameHi: string | null } | null;
  nameEn: string;
  nameHi: string | null;
  summaryEn?: string | null;
  summaryHi?: string | null;
  pricePaise: number;
  mrpPaise: number | null;
  universal: boolean;
  featured?: boolean;
  imageId: string | null;
  stock: StockLevel;
  category: { slug: string; nameEn: string; nameHi: string | null };
};

const STOCK_STYLES: Record<StockLevel, string> = {
  in_stock: "text-success",
  low_stock: "text-warning",
  out_of_stock: "text-danger",
  unknown: "text-muted",
};

export function StockLabel({ stock, t, className }: { stock: StockLevel; t: TFunction; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", STOCK_STYLES[stock], className)}>
      <span aria-hidden className={cn("size-2 rounded-full bg-current", stock === "unknown" && "opacity-50")} />
      {t(`shop.stock.${stock}`)}
    </span>
  );
}

export function Price({ pricePaise, mrpPaise, locale, t, size = "md" }: { pricePaise: number; mrpPaise: number | null; locale: Locale; t: TFunction; size?: "md" | "lg" }) {
  const pct = discountPercent(pricePaise, mrpPaise);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn("font-bold tracking-tight", size === "lg" ? "text-3xl" : "text-lg")}>{formatPaise(pricePaise, locale)}</span>
      {pct && (
        <>
          <span className={cn("text-muted line-through", size === "lg" ? "text-base" : "text-sm")}>
            <span className="sr-only">{t("shop.mrp")} </span>
            {formatPaise(mrpPaise!, locale)}
          </span>
          <span className={cn("rounded-md bg-success-soft px-1.5 py-0.5 font-semibold text-success", size === "lg" ? "text-sm" : "text-xs")}>{t("shop.off", { pct })}</span>
        </>
      )}
    </div>
  );
}

/**
 * Store product tile: soft image well, one highlight pill (bestseller or universal fit),
 * category, name, availability and price. The whole tile is the link target.
 */
export function ProductCard({ product, locale, t, priority }: { product: CardProduct; locale: Locale; t: TFunction; priority?: boolean }) {
  const name = localized(locale, product.nameEn, product.nameHi);
  const badge = product.featured ? t("shop.bestseller") : product.universal ? t("shop.fitsAll") : null;
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-muted">
        <ProductVisual imageId={product.imageId} categorySlug={product.category.slug} typeSlug={product.type?.slug} alt="" priority={priority} className="transition duration-500 group-hover:scale-[1.04]" />
        {product.stock === "out_of_stock" && (
          <span className="absolute inset-x-3 bottom-3 rounded-md bg-surface/90 py-1.5 text-center text-xs font-semibold text-danger backdrop-blur">{t("shop.stock.out_of_stock")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-0.5 pt-3">
        <p className="truncate text-xs text-muted">
          {product.type ? localized(locale, product.type.nameEn, product.type.nameHi) : localized(locale, product.category.nameEn, product.category.nameHi)}
        </p>
        {badge && <span className="w-fit rounded-full bg-foreground px-2.5 py-0.5 text-[0.7rem] font-semibold text-white">{badge}</span>}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium sm:text-[0.95rem]">
          <Link href={`/${locale}/protection/${product.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:underline group-hover:underline-offset-4">
            {name}
          </Link>
        </h3>
        <StockLabel stock={product.stock} t={t} />
        <div className="mt-auto pt-1">
          <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} locale={locale} t={t} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4", className)}>{children}</ul>;
}
