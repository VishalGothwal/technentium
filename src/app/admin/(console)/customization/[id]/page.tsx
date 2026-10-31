import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { can, canAny } from "@/server/rbac/actor";
import { isAppError } from "@/server/errors";
import { getCustomizationForStaff } from "@/server/modules/customization/customization.service";
import { canShareQuote, CUSTOMIZATION_TONE, staffTargets } from "@/server/modules/customization/state";
import { createT } from "@/i18n/translate";
import { readConfig } from "@/lib/customization/config";
import { formatDateTime, formatPaise } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { ConfigPreview } from "@/components/customization/config-preview";
import { NextStepsForm, NoteForm, QuoteForm, StatusActions } from "./request-actions";

export const instant = false;

const t = createT("en");

export async function generateMetadata({ params }: PageProps<"/admin/customization/[id]">) {
  return { title: `Design request ${(await params).id.slice(0, 8)}` };
}

export default async function CustomizationDetailPage({ params }: PageProps<"/admin/customization/[id]">) {
  const actor = await requireStaffPage();
  if (!canAny(actor, "customization.manage", "customization.technical_input")) return <NoAccess />;
  const { id } = await params;
  let req;
  try {
    req = await getCustomizationForStaff(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const manage = can(actor, "customization.manage");
  const c = readConfig(req.configuration);
  const who = (uid: string | null) => (uid ? (req.names[uid] ?? "Unknown") : "System");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {req.reference}
            <Badge tone={CUSTOMIZATION_TONE[req.status]}>{t(`studio.status.${req.status}`)}</Badge>
          </span>
        }
        description={`${req.deviceModel.brand.name} ${req.deviceModel.name} · submitted ${formatDateTime(req.createdAt)}`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex h-96 items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#2a2352_0%,#0b0c14_75%)] p-6">
              <ConfigPreview configuration={req.configuration} label={`Preview of ${req.reference}`} className="h-full" />
            </div>
            <p className="px-4 py-2 text-xs text-muted">Rendered from the saved configuration snapshot. Illustrative — check artwork resolution before printing.</p>
          </Card>

          <Card>
            <CardHeader title="Configuration" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Device", `${c?.device.brand ?? req.deviceModel.brand.name} ${c?.device.name ?? req.deviceModel.name} (${req.deviceModel.category.nameEn})`],
                  ["Design", c?.design ? `${c.design.nameEn} (${c.design.slug})` : "Blank canvas"],
                  ["Pattern", c ? `${c.style.pattern}, density ${c.style.density}, angle ${c.style.angle}°` : "—"],
                  [
                    "Palette",
                    <span key="p" className="flex flex-wrap gap-1.5">
                      {c?.style.palette.map((hex, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-xs">
                          <span className="size-3 rounded-sm border border-border" style={{ background: hex }} aria-hidden />
                          {hex}
                        </span>
                      ))}
                    </span>,
                  ],
                  ["Finish", c ? `${c.finish.nameEn}${c.finish.deltaPaise ? ` (+${formatPaise(c.finish.deltaPaise)})` : ""}` : "—"],
                  ["Coverage", c ? `${c.coverage.nameEn}${c.coverage.deltaPaise ? ` (+${formatPaise(c.coverage.deltaPaise)})` : ""}` : "—"],
                  ["Text", c?.text ? `“${c.text.value}” · ${c.text.font}, ${c.text.position}, ${c.text.color}` : "None"],
                  ["Artwork placement", c?.artwork ? `scale ${c.artwork.scale}, x ${c.artwork.x}, y ${c.artwork.y}` : "None"],
                  ["Estimate (at submission)", req.estimatePaise != null ? formatPaise(req.estimatePaise) : "—"],
                  ["Quoted price", req.quotedPaise != null ? formatPaise(req.quotedPaise) : "Not shared"],
                  ["Customer notes", req.customerNotes ?? "—"],
                ]}
              />
              {req.artwork.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">Artwork (private)</p>
                  <div className="flex flex-wrap gap-3">
                    {req.artwork.map((a) => (
                      <a key={a.id} href={mediaUrl(a.id)} target="_blank" rel="noreferrer" className="block w-32 overflow-hidden rounded-lg border border-border text-xs text-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, authorised image route */}
                        <img src={mediaUrl(a.id)} alt={`Artwork for ${req.reference}`} className="aspect-square w-full object-cover" />
                        <span className="block px-2 py-1">
                          {a.width}×{a.height}px · {Math.round(a.sizeBytes / 1024)} KB
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Name", req.customer.name],
                  ["Phone", req.customer.phoneNumber ?? "—"],
                  ["Email", req.customer.email.endsWith(".invalid") ? "—" : req.customer.email],
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          {manage && (
            <Card>
              <CardHeader title="Actions" description="Every change is recorded and the customer is notified (in-app + email)." />
              <CardBody className="space-y-5">
                <StatusActions id={req.id} targets={staffTargets(req.status).map((s) => ({ value: s, label: t(`studio.status.${s}`) }))} />
                {canShareQuote(req.status) && <QuoteForm id={req.id} current={req.quotedPaise ?? req.estimatePaise} revising={req.status === "QUOTE_SHARED"} />}
                <NextStepsForm id={req.id} current={req.nextSteps ?? ""} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Notes" description={manage ? "Internal notes stay with the team; customer notes are shown on their request page." : "Add technical input for the team (internal only)."} />
            <CardBody className="space-y-4">
              <NoteForm id={req.id} allowCustomer={manage} />
              {req.notes.length === 0 ? (
                <p className="text-sm text-muted">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {[...req.notes].reverse().map((n) => (
                    <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                      <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <span>
                          {who(n.authorId)} · {formatDateTime(n.createdAt)}
                        </span>
                        <Badge tone={n.visibility === "CUSTOMER" ? "info" : "neutral"}>{n.authorId === req.customerId ? "From customer" : n.visibility === "CUSTOMER" ? "Visible to customer" : "Internal"}</Badge>
                      </p>
                      <p className="mt-1 whitespace-pre-line">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Status history" />
            <CardBody>
              <ol className="space-y-3 border-l border-border pl-4">
                {[...req.history].reverse().map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" aria-hidden />
                    <p className="font-medium">
                      {h.fromStatus ? `${t(`studio.status.${h.fromStatus}`)} → ` : ""}
                      {t(`studio.status.${h.toStatus}`)}
                    </p>
                    {h.reason && <p className="whitespace-pre-line text-muted">{h.reason}</p>}
                    <p className="text-xs text-muted">
                      {who(h.actorId)} · {formatDateTime(h.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
