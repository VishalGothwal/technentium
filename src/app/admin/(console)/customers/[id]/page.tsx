import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { isAppError } from "@/server/errors";
import { getCustomer } from "@/server/modules/customers/customer.service";
import { createT } from "@/i18n/translate";
import { formatDate } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeader } from "@/components/ui/surface";
import { customerStatus } from "@/components/repair/status";

import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Customer" };
export const instant = false;

const t = createT("en");

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "customer.view")) return <NoAccess />;
  const { id } = await params;
  let c;
  try {
    c = await getCustomer(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const yesNo = (v: boolean | null) => (v ? <Badge tone="success">Verified</Badge> : <Badge>Not verified</Badge>);

  return (
    <>
      <PageHeader title={c.name} description={<Link href="/admin/customers" className="hover:underline">← Customers</Link>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader title="Contact" />
          <CardBody>
            <DescriptionList
              items={[
                ["Phone", c.phoneNumber ? <span key="p" className="flex flex-wrap gap-2">{c.phoneNumber} {yesNo(c.phoneNumberVerified)}</span> : null],
                ["Email", c.email ? <span key="e" className="flex flex-wrap gap-2">{c.email} {yesNo(c.emailVerified)}</span> : null],
                ["Language", c.preferredLocale === "hi" ? "Hindi" : "English"],
                ["Joined", formatDate(c.createdAt)],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Bookings" description={`${c.bookings.length} total`} />
          <CardBody>
            {c.bookings.length === 0 ? (
              <EmptyState title="No bookings yet" />
            ) : (
              <ul className="divide-y divide-border">
                {c.bookings.map((b) => {
                  const s = customerStatus(b.status, b.job);
                  return (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <Link href={b.job ? `/admin/jobs/${b.job.id}` : `/admin/bookings/${b.id}`} className="min-w-0 hover:underline">
                        <span className="font-medium">{b.reference}</span> · {b.model.name} · {formatDate(b.createdAt)}
                      </Link>
                      <Badge tone={s.tone}>{t(`status.${s.kind}.${s.status}`)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
