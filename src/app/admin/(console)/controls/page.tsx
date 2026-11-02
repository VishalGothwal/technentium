import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { getFeatureControls } from "@/server/modules/settings/features.service";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { MaintenanceMessageForm, SwitchList, TestOtpTools } from "@/components/admin/controls/feature-controls";

export const metadata = { title: "Feature controls" };
export const instant = false;

const time = (d: Date) =>
  d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });

export default async function FeatureControlsPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "system.features")) return <NoAccess />;
  const { features: f, testOtps, checks } = await getFeatureControls(actor);

  return (
    <>
      <PageHeader
        title="Feature controls"
        description="Switch parts of the platform on and off while testing. Changes apply within seconds and are recorded in Audit history."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Sign-in"
            description="Which ways customers can sign in and whether new accounts can be created. Staff always sign in with email and password."
          />
          <CardBody>
            <SwitchList
              switches={[
                {
                  key: "features.signUp",
                  label: "New sign-ups",
                  description: "Off: only existing accounts can sign in (Google and OTP won't create accounts).",
                  on: f.signUp,
                },
                {
                  key: "features.signIn.google",
                  label: "Continue with Google",
                  description: "Needs the Google provider enabled in Supabase → Authentication → Providers.",
                  on: f.signIn.google,
                },
                {
                  key: "features.signIn.phoneOtp",
                  label: "Mobile number + OTP",
                  description: "Needs the Phone provider and the Send SMS hook in Supabase.",
                  on: f.signIn.phoneOtp,
                },
                {
                  key: "features.signIn.emailPassword",
                  label: "Email and password",
                  description: "Customer sign-in and sign-up with email.",
                  on: f.signIn.emailPassword,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Site sections"
            description="Off: the section shows a “temporarily unavailable” notice and new requests are refused. Existing records stay visible in accounts."
          />
          <CardBody>
            <SwitchList
              switches={[
                {
                  key: "features.section.repairs",
                  label: "Repair booking",
                  description: "Book a repair wizard and booking API.",
                  on: f.sections.repairs,
                },
                {
                  key: "features.section.shop",
                  label: "Protection shop",
                  description: "Cart, checkout and product requests.",
                  on: f.sections.shop,
                },
                {
                  key: "features.section.customization",
                  label: "Customization studio",
                  description: "Design studio and custom design requests.",
                  on: f.sections.customization,
                },
                {
                  key: "features.section.content",
                  label: "Articles, videos & specs",
                  description: "Guides, videos, specifications and comparisons.",
                  on: f.sections.content,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Testing" />
          <CardBody>
            <SwitchList
              switches={[
                {
                  key: "features.testMode",
                  label: "Test mode",
                  description: "Sign-in codes are not texted — they appear below instead (no SMS credit used). A “Test mode” strip shows on the site.",
                  on: f.testMode,
                },
                {
                  key: "features.impersonation",
                  label: "Switch user",
                  description: "Lets admins with the permission open any non-owner account (Users & access → Switch to this user). Audited.",
                  on: f.impersonation,
                },
                {
                  key: "features.maintenance",
                  label: "Maintenance mode",
                  description: "Customers see a maintenance page; signed-in staff still see the whole site.",
                  on: f.maintenance,
                  danger: true,
                },
              ]}
            />
            <div className="mt-4 border-t border-border pt-4">
              <MaintenanceMessageForm message={f.maintenanceMessage} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Test-mode sign-in codes" description="Codes captured in the last hour while test mode was on." action={<TestOtpTools />} />
          <CardBody>
            {testOtps.length === 0 ? (
              <EmptyState
                title="No codes yet"
                description={f.testMode ? "Request a code on the sign-in page; it will appear here." : "Turn on test mode to capture codes here."}
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {testOtps.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2">
                    <span>{o.phone}</span>
                    <span className="font-mono text-lg tracking-[0.3em]">{o.code}</span>
                    <span className="text-muted">{time(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Setup check" description="What the server can see of the Supabase configuration (values are never shown)." />
          <CardBody>
            <ul className="divide-y divide-border text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-muted">{c.hint}</span>
                  </span>
                  {c.ok ? <Badge tone="success">Ready</Badge> : <Badge tone="warning">Not set</Badge>}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
