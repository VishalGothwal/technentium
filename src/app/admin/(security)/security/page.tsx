import { requireStaffPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { ChangePasswordForm, TwoFactorSetup } from "@/components/admin/security/security-client";

export const metadata = { title: "Security" };
export const instant = false;

export default async function SecurityPage() {
  const actor = await requireStaffPage();
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { email: true, twoFactorEnabled: true } });

  return (
    <>
      <PageHeader title="Security" description={`Sign-in security for ${user.email}.`} />
      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader title="Two-factor sign-in" description="A code from your phone at every new sign-in, so a leaked password alone can't open the console." />
          <CardBody>
            <TwoFactorSetup enabled={!!user.twoFactorEnabled} />
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
