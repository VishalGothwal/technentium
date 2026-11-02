import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getFeatures } from "@/server/features";
import { can } from "@/server/rbac/actor";
import { getUserDetail } from "@/server/modules/users/user-admin.service";
import { formatDate } from "@/lib/format";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { UserAccessControls, UserProfileForm } from "@/components/admin/users/user-controls";
import { StartViewAsButton } from "@/components/admin/users/view-as";

export const metadata = { title: "User" };
export const instant = false;

export default async function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const actor = await requireStaffPage();
  if (!can(actor, "user.manage")) return <NoAccess />;
  const { id } = await params;
  let u;
  try {
    u = await getUserDetail(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const isSelf = u.id === actor.userId;
  const isOwner = u.roleKeys.includes("owner");
  const canViewAs = can(actor, "user.impersonate") && (await getFeatures()).impersonation && !isSelf && !isOwner && !u.blockedAt;
  const isStaff = !!u.staffProfile?.active && u.roleKeys.length > 0;
  const yes = (v: boolean | null | undefined, on = "Yes", off = "No") => (v ? <Badge tone="success">{on}</Badge> : <Badge>{off}</Badge>);

  return (
    <>
      <PageHeader
        title={u.staffProfile?.displayName || u.name}
        description={
          <Link href="/admin/users" className="hover:underline">
            ← Users & access
          </Link>
        }
        actions={canViewAs ? <StartViewAsButton userId={u.id} isStaff={isStaff} /> : undefined}
      />
      {u.blockedAt && (
        <Alert tone="danger" className="mb-4" title={`Blocked since ${formatDate(u.blockedAt)}`}>
          {u.blockedReason ?? "No reason recorded."}
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Profile" description="Changes apply to the Supabase login as well." />
            <CardBody>
              <UserProfileForm
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  phoneNumber: u.phoneNumber,
                  preferredLocale: u.preferredLocale,
                  displayName: u.staffProfile ? u.staffProfile.displayName : null,
                }}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Access controls" description="Every action here is recorded in Audit history." />
            <CardBody>
              <UserAccessControls
                user={{
                  id: u.id,
                  name: u.name,
                  blocked: !!u.blockedAt,
                  hasEmail: !!u.email,
                  twoFactor: !!u.twoFactorEnabled || (u.auth?.factors ?? 0) > 0,
                  isSelf,
                  linked: !!u.authUserId,
                  adminConfigured: u.adminConfigured,
                }}
              />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Sign-in" />
            <CardBody>
              {u.authError && (
                <Alert tone="warning" className="mb-3">
                  {u.authError}
                </Alert>
              )}
              <DescriptionList
                items={[
                  [
                    "Supabase login",
                    u.authUserId ? (
                      <code key="id" className="text-xs break-all">
                        {u.authUserId}
                      </code>
                    ) : (
                      "Not linked yet — links on their next sign-in, or create one with a password."
                    ),
                  ],
                  ["Methods", u.auth ? u.auth.providers.join(", ") || "—" : "—"],
                  ["Email confirmed", yes(u.auth?.emailConfirmed ?? u.emailVerified)],
                  ["Phone confirmed", yes(u.auth?.phoneConfirmed ?? u.phoneNumberVerified)],
                  ["Two-factor", yes(!!u.twoFactorEnabled || (u.auth?.factors ?? 0) > 0, "On", "Off")],
                  ["Last sign-in", u.auth?.lastSignInAt ? formatDate(u.auth.lastSignInAt) : u.lastSignInAt ? formatDate(u.lastSignInAt) : "—"],
                  ["Signed out everywhere", u.sessionsRevokedAt ? formatDate(u.sessionsRevokedAt) : "—"],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Roles", u.roles.length ? u.roles.map((r) => r.role.name).join(", ") : "Customer"],
                  ["Staff status", u.staffProfile ? (u.staffProfile.active ? "Active" : "Deactivated") : "—"],
                  ["Repairs", String(u._count.bookings)],
                  ["Product requests", String(u._count.productRequests)],
                  ["Design requests", String(u._count.customizationRequests)],
                  ["Joined", formatDate(u.createdAt)],
                ]}
              />
              <p className="mt-3 text-sm">
                {u.staffProfile ? (
                  <Link href="/admin/team" className="text-primary hover:underline">
                    Change roles in Team & roles →
                  </Link>
                ) : (
                  <Link href={`/admin/customers/${u.id}`} className="text-primary hover:underline">
                    Customer history →
                  </Link>
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
