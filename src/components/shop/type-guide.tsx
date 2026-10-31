import Link from "next/link";
import { localized, type TFunction } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { ProductTypeSummary, TypeHighlights } from "@/server/modules/shop/catalog.service";
import { ProductVisual } from "./product-visual";
import { Rail } from "./rail";

const GLASS_TRAITS = ["clarity", "privacy", "antiGlare", "toughness"] as const;
const CASE_TRAITS = ["protection", "grip", "slim", "showsColour"] as const;

/**
 * "Shop by type" for one category: a card per type (photo when uploaded, otherwise its illustration)
 * and a comparison table of the 1–5 trait scores, so shoppers can tell HD+ from Privacy from Matte.
 */
export function TypeGuide({ title, types, locale, t }: { title: string; types: ProductTypeSummary[]; locale: Locale; t: TFunction }) {
  if (types.length === 0) return null;
  const categorySlug = types[0].category.slug;
  const traits = categorySlug === "cases-covers" ? CASE_TRAITS : GLASS_TRAITS;
  const scored = types.filter((x) => traits.some((k) => x.highlights[k]));
  const href = (slug: string) => `/${locale}/protection/products?category=${categorySlug}&type=${slug}`;

  return (
    <div>
      <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
      <Rail className="mt-4" listClassName="gap-3 py-1" label={title}>
        {types.map((x) => (
          <li key={x.id} className="w-[15.5rem] shrink-0 snap-start sm:w-64">
            <Link href={href(x.slug)} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-foreground">
              <div className="aspect-[4/3] overflow-hidden bg-surface-muted">
                <ProductVisual imageId={x.imageMediaId} categorySlug={categorySlug} typeSlug={x.slug} className="transition duration-500 group-hover:scale-105" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold">{localized(locale, x.nameEn, x.nameHi)}</p>
                {x.descriptionEn && <p className="mt-1 line-clamp-3 text-sm text-muted">{localized(locale, x.descriptionEn, x.descriptionHi)}</p>}
                <p className="mt-auto pt-3 text-xs font-semibold tracking-wide uppercase">
                  {t("shop.typeProducts", { count: x.count })} <span aria-hidden>→</span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </Rail>

      {scored.length > 1 && (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-muted text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" className="sticky left-0 bg-surface-muted px-4 py-3 font-semibold">
                  {t("shop.type")}
                </th>
                {traits.map((k) => (
                  <th key={k} scope="col" className="px-3 py-3 font-semibold">
                    {t(`shop.traits.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scored.map((x) => (
                <tr key={x.id}>
                  <th scope="row" className="sticky left-0 bg-surface px-4 py-3 text-left font-semibold">
                    <Link href={href(x.slug)} className="hover:underline">
                      {localized(locale, x.nameEn, x.nameHi)}
                    </Link>
                  </th>
                  {traits.map((k) => (
                    <td key={k} className="px-3 py-3">
                      <Score value={x.highlights[k as keyof TypeHighlights]} t={t} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Score({ value, t }: { value?: number; t: TFunction }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex gap-1" role="img" aria-label={t("shop.score", { score: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("size-2.5 rounded-full", n <= value ? "bg-foreground" : "bg-border")} />
      ))}
    </span>
  );
}
