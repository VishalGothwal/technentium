import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { getStudioStepsAdmin, listDesignOptionsAdmin, listDesignsAdmin } from "@/server/modules/customization/design-admin.service";
import { formatPaise } from "@/lib/format";
import { DEFAULT_BASE_PRICE_PAISE } from "@/lib/customization/pricing";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { STEP_LABELS } from "@/lib/customization/steps";
import { StudioStepsEditor } from "./studio-steps-editor";
import { NoAccess } from "@/components/admin/no-access";
import { DevicePreview } from "@/components/customization/device-preview";
import { ArchiveToggle } from "./design-form";
import { OptionsEditor } from "./options-editor";

export const metadata = { title: "Design catalogue" };
export const instant = false;

export default async function DesignsAdminPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "customization.manage")) return <NoAccess />;
  const [designs, options, hiddenSteps] = await Promise.all([listDesignsAdmin(actor), listDesignOptionsAdmin(actor), getStudioStepsAdmin(actor)]);

  return (
    <>
      <PageHeader
        title="Design catalogue"
        description="Designs, finishes and coverage options offered in the customization studio. Changes appear on the public site immediately."
        actions={<ButtonLink href="/admin/designs/new">New design</ButtonLink>}
      />

      <Card className="mb-8">
        <CardHeader
          title="Studio sections"
          description="Choose which steps customers see in the customization studio. A hidden step uses its default (first finish and coverage, the design's own colours, no text or artwork). Each design can hide more steps on its own edit page."
        />
        <CardBody>
          <StudioStepsEditor hidden={hiddenSteps} />
        </CardBody>
      </Card>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {designs.map((d) => (
          <li key={d.id} className={d.active ? "" : "opacity-60"}>
            <div className="flex h-full flex-col rounded-[var(--radius)] border border-border bg-surface p-3">
              <Link href={`/admin/designs/${d.id}`} className="flex h-40 items-center justify-center rounded-lg bg-[#14161f] p-3">
                <DevicePreview kind="phone" style={d.style} finish="gloss" coverage="camera" seed={d.slug} label={`Preview of ${d.nameEn}`} className="h-full" />
              </Link>
              <div className="mt-2 flex flex-1 flex-col text-sm">
                <Link href={`/admin/designs/${d.id}`} className="font-medium text-primary hover:underline">
                  {d.nameEn}
                </Link>
                <p className="text-xs text-muted">
                  {d.collection} · {d.style.pattern} · {formatPaise(d.basePricePaise ?? DEFAULT_BASE_PRICE_PAISE)}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {!d.active && <Badge>Archived</Badge>}
                  {d.featured && <Badge tone="primary">Featured</Badge>}
                  {d.hiddenSteps.map((s) => (
                    <Badge key={s}>No {STEP_LABELS[s as keyof typeof STEP_LABELS]?.label.toLowerCase() ?? s}</Badge>
                  ))}
                  {d._count.requests > 0 && <Badge tone="info">{d._count.requests} {d._count.requests === 1 ? "request" : "requests"}</Badge>}
                </p>
                <div className="mt-auto pt-2">
                  <ArchiveToggle id={d.id} active={d.active} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-lg font-semibold">Finishes & coverage</h2>
      <OptionsEditor
        options={options.map((o) => ({
          id: o.id,
          kind: o.kind,
          slug: o.slug,
          nameEn: o.nameEn,
          nameHi: o.nameHi ?? "",
          descriptionEn: o.descriptionEn ?? "",
          descriptionHi: o.descriptionHi ?? "",
          priceDeltaPaise: o.priceDeltaPaise,
          active: o.active,
          sortOrder: o.sortOrder,
        }))}
      />
    </>
  );
}
