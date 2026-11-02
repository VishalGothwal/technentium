import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDeliverableEmail } from "@/server/providers/email";
import { ROLE_DEFINITIONS } from "@/server/rbac/permissions";
import { Alert, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { OwnEmailForm, OwnProfileForm } from "@/components/admin/profile/own-profile";

export const metadata = { title: "My profile" };
export const instant = false;

export default async function MyProfilePage() {
  const actor = await requireStaffPage();
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
      preferredLocale: true,
      twoFactorEnabled: true,
      staffProfile: { select: { displayName: true } },
    },
  });

  return (
    <>
      <PageHeader title="My profile" description="Your name, sign-in email and language in the console." />
      {actor.impersonator && (
        <Alert tone="info" className="mb-4">
          You&apos;re switched into this account: profile edits apply to {actor.name}; the email change is only available to them.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <OwnProfileForm
              profile={{
                name: user.name,
                displayName: user.staffProfile?.displayName ?? user.name,
                preferredLocale: user.preferredLocale,
              }}
            />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Sign-in email" description="Used to sign in to the console." />
            <CardBody>
              <OwnEmailForm email={isDeliverableEmail(user.email) ? user.email : null} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Roles", actor.roles.map((r) => ROLE_DEFINITIONS[r].name).join(", ")],
                  ["Mobile number", user.phoneNumber ?? "—"],
                  ["Two-factor", user.twoFactorEnabled ? "On" : "Off"],
                ]}
              />
              <p className="mt-3 text-sm text-muted">
                Password and two-factor are on the{" "}
                <Link href="/admin/security" className="text-primary hover:underline">
                  Security
                </Link>{" "}
                page. An Owner can change your mobile number in Users &amp; access.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
