import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { isAppError } from "@/server/errors";
import { getDeviceHub } from "@/server/modules/catalog/device-insights.service";
import { formatPaise } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { DeviceBasics } from "@/components/admin/catalog/device-basics";

export const metadata = { title: "Device" };
export const instant = false;

const range = (min: number | null, max: number | null) => (min === null ? "—" : max && max !== min ? `${formatPaise(min)} – ${formatPaise(max)}` : formatPaise(min));

/** One device and everything attached to it: photo and basics, repairs, spec sheet, customization, protection. */
export default async function DeviceHubPage({ params }: PageProps<"/admin/devices/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "catalog.manage")) return <NoAccess />;
  const { id } = await params;
  const d = await getDeviceHub(actor, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  const publicPath = `/en/repairs/${d.category.slug}/${d.brand.slug}/${d.slug}`;
  const specLive = d.specification?.status === "PUBLISHED";
  const usedOn = ["repair pages", "booking picker", "customization studio", "site search", d.specification?.imageMediaId ? "(the spec sheet has its own photo)" : "spec sheet"];

  return (
    <>
      <PageHeader
        title={`${d.brand.name} ${d.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {[d.category.nameEn, d.series, d.releaseYear].filter(Boolean).join(" · ")}
            {d.active && d.brand.active ? <Badge tone="success">Live</Badge> : <Badge>Hidden</Badge>}
            {d.popular && <Badge tone="primary">Popular</Badge>}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/devices" variant="secondary">
              ← All devices
            </ButtonLink>
            <ButtonLink href={publicPath} variant="secondary" target="_blank">
              View repair page ↗
            </ButtonLink>
          </div>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Photo & basics" description="One photo per device, used across the whole website." />
          <CardBody>
            <DeviceBasics device={{ id: d.id, brandId: d.brandId, name: d.name, releaseYear: d.releaseYear, active: d.active, popular: d.popular, imageMediaId: d.imageMediaId }} usedOn={usedOn} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Repairs"
            description={`${d._count.bookings} ${d._count.bookings === 1 ? "booking" : "bookings"} all time. Estimates shown to customers before diagnosis.`}
            action={
              <ButtonLink href="/admin/catalog" variant="secondary" size="sm">
                Edit estimates →
              </ButtonLink>
            }
          />
          <CardBody className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Estimates per issue</h3>
              {d.repairEstimates.length === 0 ? (
                <p className="text-sm text-muted">No repair issues set up for this category.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {d.repairEstimates.map((e) => (
                    <li key={e.issue} className="flex items-center justify-between gap-3 py-2">
                      <span>{e.issue}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {range(e.minPaise, e.maxPaise)}
                        {e.source && <Badge tone={e.source === "model" ? "primary" : "neutral"}>{e.source === "model" ? "This model" : "Default"}</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Latest bookings</h3>
              {d.bookings.length === 0 ? (
                <p className="text-sm text-muted">No bookings yet.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {d.bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium hover:underline">
                        {b.reference}
                      </Link>
                      <span className="text-xs text-muted">
                        {b.status.toLowerCase().replace(/_/g, " ")} · {b.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader title="Spec sheet" />
            <CardBody className="space-y-3 text-sm">
              {d.specification ? (
                <>
                  <p className="flex items-center gap-2">
                    Status <Badge tone={specLive ? "success" : "warning"}>{d.specification.status.toLowerCase()}</Badge>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/admin/specs/${d.specification.id}`} size="sm">
                      Edit spec sheet
                    </ButtonLink>
                    {specLive && (
                      <ButtonLink href={`/en/specs/${d.specification.slug}`} variant="secondary" size="sm" target="_blank">
                        View ↗
                      </ButtonLink>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted">No spec sheet yet. Creating one adds the device to Phone specs and comparisons.</p>
                  <ButtonLink href={`/admin/specs/new?model=${d.id}`} size="sm">
                    Create spec sheet
                  </ButtonLink>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customization" />
            <CardBody className="space-y-3 text-sm">
              <p>
                3D model:{" "}
                {d.model3d ? (
                  <Link href={`/admin/models-3d/${d.model3d.id}`} className="font-medium hover:underline">
                    {d.model3d.name}
                    {d.model3d.fileId ? " (.glb)" : ""}
                  </Link>
                ) : (
                  <span className="text-muted">generated from its camera layout{d.frame ? ` (${d.frame})` : ""}</span>
                )}
              </p>
              <p>
                {d._count.customizationRequests} custom design {d._count.customizationRequests === 1 ? "request" : "requests"}
              </p>
              <ButtonLink href={d.model3d ? `/admin/models-3d/${d.model3d.id}` : "/admin/models-3d"} variant="secondary" size="sm">
                {d.model3d ? "Edit 3D model" : "Assign a 3D model"}
              </ButtonLink>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Protection" />
            <CardBody className="space-y-3 text-sm">
              <p>
                {d.products.length} {d.products.length === 1 ? "product fits" : "products fit"} this device, plus {d.universalProducts} universal.
              </p>
              {d.products.length > 0 && (
                <ul className="space-y-1">
                  {d.products.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/products/${p.id}`} className="truncate hover:underline">
                        {p.nameEn}
                      </Link>
                      {p.status !== "ACTIVE" && <Badge>{p.status.toLowerCase()}</Badge>}
                    </li>
                  ))}
                  {d.products.length > 8 && <li className="text-xs text-muted">+ {d.products.length - 8} more</li>}
                </ul>
              )}
              <ButtonLink href="/admin/products" variant="secondary" size="sm">
                Manage products →
              </ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
