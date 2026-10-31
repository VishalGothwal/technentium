"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { ProductVisual } from "./product-visual";
import { Chevron } from "./rail";

/** Product gallery: large image with prev/next arrows and thumbnail buttons; falls back to the category illustration. */
export function Gallery({ images, categorySlug, typeSlug, name }: { images: { id: string; alt: string }[]; categorySlug: string; typeSlug?: string | null; name: string }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const current = images[active];
  const many = images.length > 1;
  const step = (dir: 1 | -1) => setActive((i) => (i + dir + images.length) % images.length);
  const arrow = "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 shadow-sm transition hover:bg-foreground hover:text-white";
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-muted">
        <ProductVisual imageId={current?.id ?? null} categorySlug={categorySlug} typeSlug={typeSlug} alt={current?.alt || name} priority sizes="(min-width: 768px) 55vw, 100vw" />
        {many && (
          <>
            <button type="button" onClick={() => step(-1)} aria-label={t("shop.prevImage")} className={cn(arrow, "left-3")}>
              <Chevron className="rotate-180" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t("shop.nextImage")} className={cn(arrow, "right-3")}>
              <Chevron />
            </button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-2.5 py-0.5 text-xs font-medium tabular-nums">
              {t("shop.imageOf", { n: active + 1, total: images.length })}
            </p>
          </>
        )}
      </div>
      {many && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={t("shop.showImage", { n: i + 1 })}
                aria-current={i === active}
                className={cn("size-16 overflow-hidden rounded-md border-2 bg-surface-muted sm:size-20", i === active ? "border-foreground" : "border-transparent hover:border-border")}
              >
                <ProductVisual imageId={img.id} categorySlug={categorySlug} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
