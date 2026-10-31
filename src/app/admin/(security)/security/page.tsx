import { requireStaffPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { ChangePasswordForm, TwoFactorPanel } from "@/components/admin/security/security-client";

export const metadata = { title: "Security" };
export const instant = false;

export default async function SecurityPage() {
  // The one page an Owner can open before enabling two-factor sign-in.
  const actor = await requireStaffPage({ allowWithoutTwoFactor: true });
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { twoFactorEnabled: true, email: true } });
  const isOwner = actor.roles.includes("owner");

  return (
    <>
      <PageHeader title="Security" description={`Sign-in security for ${user.email}.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Two-factor authentication"
            description={isOwner ? "Required for Owner accounts. Use an authenticator app such as Google Authenticator or Microsoft Authenticator." : "Recommended for all staff accounts."}
          />
          <CardBody>
            <TwoFactorPanel enabled={!!user.twoFactorEnabled} required={isOwner} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" description="Other signed-in sessions are signed out." />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
