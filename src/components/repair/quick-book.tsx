"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, House } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

export type QuickBookCategory = { slug: string; name: string; brands: { id: string; slug: string; name: string }[] };
type Model = { id: string; name: string };

/**
 * Short booking card: device → brand → model, then on into the booking wizard with the model filled in.
 * Stopping early still helps: a device or brand alone opens that repair page to pick from.
 */
export function QuickBook({ categories, initialCategory = "", className }: { categories: QuickBookCategory[]; initialCategory?: string; className?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [models, setModels] = useState<{ brandId: string; items: Model[] } | null>(null);

  const brands = categories.find((c) => c.slug === category)?.brands ?? [];
  const brand = brands.find((b) => b.id === brandId);

  useEffect(() => {
    if (!brandId) return;
    let alive = true;
    apiFetch<Model[]>(`/api/v1/devices/models?brandId=${brandId}`, { locale })
      .then((items) => alive && setModels({ brandId, items }))
      .catch(() => alive && setModels({ brandId, items: [] }));
    return () => {
      alive = false;
    };
  }, [brandId, locale]);
  const modelList = models?.brandId === brandId ? models.items : [];

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const base = `/${locale}/repairs`;
    if (modelId) return router.push(`${base}/book?model=${modelId}`);
    if (brand) return router.push(`${base}/${category}/${brand.slug}`);
    if (category) return router.push(`${base}/${category}`);
    router.push(`${base}/book`);
  };

  return (
    <form onSubmit={go} className={cn("rounded-2xl border border-border bg-surface p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)] sm:p-6", className)}>
      <p className="text-center font-display text-xl font-bold tracking-tight">{t("site.quickBook.title")}</p>
      <p className="mt-1 text-center text-sm text-muted">{t("site.quickBook.body")}</p>
      <div className="mt-5 grid gap-3">
        <Select
          aria-label={t("site.quickBook.device")}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setBrandId("");
            setModelId("");
          }}
        >
          <option value="">{t("site.quickBook.device")}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select
            aria-label={t("site.quickBook.brand")}
            value={brandId}
            disabled={!category}
            onChange={(e) => {
              setBrandId(e.target.value);
              setModelId("");
            }}
          >
            <option value="">{t("site.quickBook.brand")}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select aria-label={t("site.quickBook.model")} value={modelId} disabled={!brandId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">{t("site.quickBook.model")}</option>
            {modelList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="lg" block className="mt-1 rounded-xl">
          {t("site.quickBook.cta")}
          <ArrowRight aria-hidden className="size-4" />
        </Button>
      </div>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 border-t border-border pt-4 text-xs text-muted">
        <li className="inline-flex items-center gap-1.5">
          <House aria-hidden className="size-3.5" />
          {t("site.quickBook.pickup")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <BadgeCheck aria-hidden className="size-3.5" />
          {t("site.quickBook.approve")}
        </li>
      </ul>
    </form>
  );
}
