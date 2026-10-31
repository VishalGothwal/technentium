import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { localized } from "@/i18n/translate";
import { requireCustomerPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getMyCustomization } from "@/server/modules/customization/customization.service";
import { CUSTOMER_CANCELLABLE, CUSTOMIZATION_STEPS, CUSTOMIZATION_TONE, customizationStep } from "@/server/modules/customization/state";
import { readConfig } from "@/lib/customization/config";
import { formatDateTime, formatPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/cn";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/surface";
import { ConfigPreview } from "@/components/customization/config-preview";
import { CancelButton, QuoteDecision, ReplyForm } from "./client";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/account/designs/[reference]">): Promise<Metadata> {
  const { reference } = await params;
  return { title: reference, robots: { index: false } };
}

const TERMINAL_BAD = new Set(["DECLINED", "CANCELLED"]);

export default async function DesignRequestPage({ params }: PageProps<"/[locale]/account/designs/[reference]">) {
  const { reference } = await params;
  const { t, locale } = await getT();
  const actor = await requireCustomerPage(locale, `/${locale}/account/designs/${reference}`);
  let req;
  try {
    req = await getMyCustomization(actor, reference);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const c = readConfig(req.configuration);
  const current = CUSTOMIZATION_STEPS.indexOf(customizationStep(req.status));
  const stopped = TERMINAL_BAD.has(req.status);
  const lastReason = [...req.history].reverse().find((h) => h.toStatus === req.status)?.reason;
  const opt = (o: { nameEn: string; nameHi: string | null } | undefined | null) => (o ? localized(locale, o.nameEn, o.nameHi) : "—");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {t("tracking.reference")} {req.reference}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {req.deviceModel.brand.name} {req.deviceModel.name}
          </h1>
        </div>
        <Badge tone={CUSTOMIZATION_TONE[req.status]} className="text-sm">
          {t(`studio.status.${req.status}`)}
        </Badge>
      </div>

      {req.status === "NEEDS_INFO" && (
        <Alert tone="warning" title={t("studio.account.needsInfoTitle")}>
          {lastReason && <p className="whitespace-pre-line">{lastReason}</p>}
          <ReplyForm reference={req.reference} />
        </Alert>
      )}
      {req.status === "DECLINED" && lastReason && (
        <Alert tone="danger" title={t("studio.account.declinedTitle")}>
          {lastReason}
        </Alert>
      )}

      {!stopped && (
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">{t("studio.account.timeline")}</h2>
          <ol className="grid grid-cols-5 gap-2" aria-live="polite">
            {CUSTOMIZATION_STEPS.map((s, i) => (
              <li key={s} aria-current={i === current ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                    i < current && "border-primary bg-primary text-primary-foreground",
                    i === current && "border-primary bg-primary-soft text-primary ring-2 ring-primary/30",
                    i > current && "border-border text-muted",
                  )}
                >
                  {i < current ? "✓" : i + 1}
                </span>
                <span className={cn("text-xs", i === current ? "font-semibold" : "text-muted")}>{t(`studio.account.steps.${s}`)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {req.status === "QUOTE_SHARED" && req.quotedPaise != null && (
        <Card>
          <CardHeader title={t("studio.account.quoteTitle")} description={t("studio.account.quoteBody")} />
          <CardBody className="space-y-4">
            <p className="text-3xl font-bold tabular-nums">{formatPaise(req.quotedPaise, locale)}</p>
            {lastReason && <p className="text-sm whitespace-pre-line">{lastReason}</p>}
            <QuoteDecision reference={req.reference} priceLabel={formatPaise(req.quotedPaise, locale)} />
          </CardBody>
        </Card>
      )}

      {req.nextSteps && (
        <Alert tone="info" title={t("studio.account.nextSteps")}>
          <p className="whitespace-pre-line">{req.nextSteps}</p>
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="overflow-hidden">
          <div className="flex h-80 items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#2a2352_0%,#0b0c14_75%)] p-6">
            <ConfigPreview configuration={req.configuration} label={t("studio.preview.label", { device: `${req.deviceModel.brand.name} ${req.deviceModel.name}` })} className="h-full" />
          </div>
          <p className="px-4 py-2 text-xs text-muted">{t("studio.preview.illustrative")}</p>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">{t("studio.account.details")}</h2>
          <DescriptionList
            className="mt-3"
            items={[
              [t("studio.review.design"), c?.design ? opt(c.design) : t("studio.design.blank")],
              [t("studio.review.finish"), opt(c?.finish)],
              [t("studio.review.coverage"), opt(c?.coverage)],
              [t("studio.review.text"), c?.text?.value ?? t("studio.review.none")],
              [t("studio.account.estimateLabel"), req.estimatePaise != null ? formatPaise(req.estimatePaise, locale) : "—"],
              ...(req.quotedPaise != null ? [[t("studio.account.quotedLabel"), formatPaise(req.quotedPaise, locale)] as [string, string]] : []),
              ...(req.customerNotes ? [[t("studio.account.yourNotes"), req.customerNotes] as [string, string]] : []),
            ]}
          />
          {req.artwork.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">{t("studio.review.artwork")}</p>
              <div className="flex gap-2">
                {req.artwork.map((a) => (
                  <a key={a.id} href={mediaUrl(a.id)} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, authorised image route */}
                    <img src={mediaUrl(a.id)} alt={t("studio.review.artwork")} className="size-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {CUSTOMER_CANCELLABLE.includes(req.status) && (
            <div className="mt-5 border-t border-border pt-4">
              <CancelButton reference={req.reference} />
            </div>
          )}
        </Card>
      </div>

      {req.notes.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">{t("studio.account.messages")}</h2>
          <ul className="mt-3 space-y-3">
            {req.notes.map((n) => (
              <li key={n.id} className={cn("max-w-[85%] rounded-xl p-3 text-sm", n.fromCustomer ? "ml-auto bg-primary-soft" : "bg-surface-muted")}>
                <p className="text-xs font-medium text-muted">{n.fromCustomer ? t("studio.account.you") : t("studio.account.team")}</p>
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold">{t("studio.account.history")}</h2>
        <ol className="mt-3 space-y-3 border-l border-border pl-4">
          {[...req.history].reverse().map((h) => (
            <li key={h.id} className="relative text-sm">
              <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" aria-hidden />
              <p className="font-medium">{t(`studio.status.${h.toStatus}`)}</p>
              {h.reason && <p className="text-muted">{h.reason}</p>}
              <p className="text-xs text-muted">{formatDateTime(h.createdAt, locale)}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
