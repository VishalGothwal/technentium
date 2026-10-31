import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listStaff } from "@/server/modules/team/team.service";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, type RoleKey } from "@/server/rbac/permissions";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { InviteStaffForm, StaffRow } from "@/components/admin/team/team-client";

import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Team & roles" };
export const instant = false;

export default async function TeamPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "team.manage")) return <NoAccess />;
  const staff = await listStaff(actor);
  const roles = ROLE_KEYS.map((k) => ({ key: k, name: ROLE_DEFINITIONS[k].name, description: ROLE_DEFINITIONS[k].description }));

  return (
    <>
      <PageHeader title="Team & roles" description="Staff accounts, their roles and sign-in security." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Invite staff" description="The invitee receives an email link to set their own password." />
          <CardBody>
            <InviteStaffForm roles={roles} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Staff" description={`${staff.length} accounts`} />
          <CardBody>
            <ul className="divide-y divide-border">
              {staff.map((s) => (
                <StaffRow
                  key={s.id}
                  roles={roles}
                  isSelf={s.id === actor.userId}
                  member={{
                    id: s.id,
                    name: s.staffProfile?.displayName || s.name,
                    email: s.email,
                    phone: s.phoneNumber,
                    active: s.staffProfile?.active ?? false,
                    twoFactor: !!s.twoFactorEnabled,
                    roles: s.roles.map((r) => r.role.key as RoleKey),
                  }}
                />
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Role permissions" description="Proposed baseline from PRD §8 — pending approval (D-10). Enforced on the server for every action." />
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium text-muted">Permission</th>
                  {ROLE_KEYS.map((k) => (
                    <th key={k} scope="col" className="px-2 py-2 text-center font-medium">
                      {ROLE_DEFINITIONS[k].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-mono text-xs font-normal">
                      {p}
                    </th>
                    {ROLE_KEYS.map((k) => {
                      const has = (ROLE_DEFINITIONS[k].permissions as readonly string[]).includes(p);
                      return (
                        <td key={k} className="px-2 py-1.5 text-center">
                          {has ? <Badge tone="success">Yes</Badge> : <span className="text-muted" aria-label="No">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
