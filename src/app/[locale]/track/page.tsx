import Link from "next/link";
import { getT } from "@/i18n/server";
import { isAppError } from "@/server/errors";
import { requireCustomerPage } from "@/server/auth/guards";
import { listActivity, trackReference } from "@/server/modules/account/account.service";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pageMetadata } from "@/lib/seo";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/surface";

// Reads the session and the searched reference.
export const instant = false;

export async function generateMetadata() {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/track", title: t("site.track.title"), description: t("site.track.subtitle"), noIndex: true });
}

const TYPE_TONE = { repair: "primary", order: "info", customization: "warning" } as const;

export default async function TrackPage({ searchParams }: PageProps<"/[locale]/track">) {
  const { t, locale } = await getT();
  const { ref } = await searchParams;
  const reference = typeof ref === "string" ? ref.trim().slice(0, 32) : "";
  const actor = await requireCustomerPage(locale, `/${locale}/track${reference ? `?ref=${encodeURIComponent(reference)}` : ""}`);

  let result: Awaited<ReturnType<typeof trackReference>> | null = null;
  let missing = false;
  if (reference) {
    try {
      result = await trackReference(actor, locale, reference);
    } catch (err) {
      if (!isAppError(err) || err.code !== "NOT_FOUND") throw err;
      missing = true;
    }
  }
  const recent = await listActivity(actor, locale, 10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t("site.track.title")}</h1>
      <p className="mt-2 text-muted">{t("site.track.subtitle")}</p>

      <form method="get" className="mt-6 flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="ref" className="sr-only">
          {t("site.track.label")}
        </label>
        <input
          id="ref"
          name="ref"
          defaultValue={reference}
          placeholder={t("site.track.placeholder")}
          autoCapitalize="characters"
          spellCheck={false}
          className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 font-mono text-base uppercase"
        />
        <button type="submit" className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">
          {t("site.track.submit")}
        </button>
      </form>

      {missing && (
        <p role="alert" className="mt-4 rounded-xl bg-warning-soft p-4 text-sm text-warning">
          {t("site.track.notFound")}
        </p>
      )}

      {result && (
        <Card className="mt-6 overflow-hidden">
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{result.reference}</span>
                <Badge tone={TYPE_TONE[result.type]}>{t(`site.track.types.${result.type}`)}</Badge>
              </span>
            }
            description={result.title}
            action={<Badge tone="neutral">{result.statusLabel}</Badge>}
          />
          <CardBody className="space-y-6">
            <ol className="grid gap-3 sm:grid-flow-col sm:auto-cols-fr" aria-label={result.statusLabel}>
              {result.steps.map((s, i) => (
                <li key={s.key} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2" aria-current={s.current ? "step" : undefined}>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                      s.done && "border-primary bg-primary text-primary-foreground",
                      s.current && "border-primary bg-primary-soft text-primary",
                      !s.done && !s.current && "border-border text-muted",
                    )}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className={cn("text-sm", s.current ? "font-semibold" : s.done ? "" : "text-muted")}>{s.label}</span>
                </li>
              ))}
            </ol>

            {"trackingInfo" in result && result.trackingInfo && (
              <div className="rounded-xl bg-info-soft p-4 text-sm">
                <p className="font-semibold">{t("site.track.trackingInfo")}</p>
                <p className="mt-1 whitespace-pre-line">{result.trackingInfo}</p>
              </div>
            )}

            {result.timeline.length > 0 && (
              <div>
                <h2 className="mb-3 font-semibold">{t("site.track.history")}</h2>
                <ol className="relative space-y-4 border-l-2 border-border pl-5">
                  {[...result.timeline].reverse().map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
                      <p className="font-medium">{e.label}</p>
                      {e.reason && <p className="text-sm text-muted">{e.reason}</p>}
                      <p className="text-xs text-muted">{formatDateTime(e.at, locale)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <Link href={result.href} className="inline-flex h-11 items-center rounded-xl border border-border px-4 font-semibold hover:bg-surface-muted">
              {t("site.track.open")} →
            </Link>
          </CardBody>
        </Card>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">{t("site.track.recent")}</h2>
        {recent.length === 0 ? (
          <EmptyState title={t("site.track.none")} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
            {recent.map((r) => (
              <li key={`${r.type}-${r.reference}`}>
                <Link href={`/${locale}/track?ref=${encodeURIComponent(r.reference)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{r.reference}</span>
                      <Badge tone={TYPE_TONE[r.type]}>{t(`site.track.types.${r.type}`)}</Badge>
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {r.title} · {t("site.track.updated", { date: formatDateTime(r.updatedAt, locale) })}
                    </span>
                  </span>
                  <Badge tone="neutral">{r.statusLabel}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
