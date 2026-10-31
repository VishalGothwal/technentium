"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/translate";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DEFAULT_BASE_PRICE_PAISE } from "@/lib/customization/pricing";
import { COLLECTIONS, type DesignStyle } from "@/lib/customization/style";
import { DevicePreview } from "./device-preview";

export type GalleryDesign = {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string | null;
  descriptionEn: string | null;
  descriptionHi: string | null;
  collection: string;
  style: DesignStyle;
  basePricePaise: number | null;
};

/** Design catalogue with collection filter chips (FR-CUSTOM-02). Every card opens the studio pre-loaded. */
export function DesignGallery({ designs }: { designs: GalleryDesign[] }) {
  const { t, locale } = useI18n();
  const [collection, setCollection] = useState<string | null>(null);
  const present = COLLECTIONS.filter((c) => designs.some((d) => d.collection === c));
  const shown = collection ? designs.filter((d) => d.collection === collection) : designs;

  return (
    <div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label={t("studio.gallery.title")}>
        {[null, ...present].map((c) => (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={collection === c}
            onClick={() => setCollection(c)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
              collection === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:bg-surface-muted",
            )}
          >
            {c ? t(`studio.gallery.collections.${c}`) : t("studio.gallery.all")}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-muted">{t("studio.gallery.empty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((d) => {
            const name = localized(locale, d.nameEn, d.nameHi);
            return (
              <li key={d.id}>
                <Link
                  href={`/${locale}/customize/studio?design=${d.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-3 transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-surface-muted motion-reduce:transform-none"
                >
                  <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-gradient-to-b from-surface-muted to-background p-4">
                    <DevicePreview kind="phone" style={d.style} finish="gloss" coverage="camera" seed={d.slug} label="" className="h-full drop-shadow-xl transition group-hover:scale-[1.03] motion-reduce:transform-none" />
                  </div>
                  <div className="mt-3 flex flex-1 flex-col">
                    <p className="text-xs font-medium uppercase tracking-wider text-accent">{t(`studio.gallery.collections.${d.collection}`)}</p>
                    <h3 className="mt-0.5 font-semibold">{name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{localized(locale, d.descriptionEn ?? "", d.descriptionHi)}</p>
                    <p className="mt-auto flex items-center justify-between pt-3 text-sm">
                      <span className="text-muted">{t("studio.gallery.from", { price: formatPaise(d.basePricePaise ?? DEFAULT_BASE_PRICE_PAISE, locale) })}</span>
                      <span className="font-semibold text-primary" aria-hidden>
                        {t("studio.gallery.customize")} →
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
