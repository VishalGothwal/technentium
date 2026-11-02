import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listUsers, type UserKind } from "@/server/modules/users/user-admin.service";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, pageParam, strParam } from "@/components/admin/pagination";
import { NoAccess } from "@/components/admin/no-access";

export const metadata = { title: "Users & access" };
export const instant = false;

const KINDS: { key: UserKind; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "customers", label: "Customers" },
  { key: "staff", label: "Staff" },
  { key: "blocked", label: "Blocked" },
];

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const actor = await requireStaffPage();
  if (!can(actor, "user.manage")) return <NoAccess />;
  const sp = await searchParams;
  const q = strParam(sp.q);
  const kind = (KINDS.find((k) => k.key === strParam(sp.kind))?.key ?? "all") as UserKind;
  const page = pageParam(sp.page);
  const { items, total, pageSize } = await listUsers(actor, { q, kind, page });

  return (
    <>
      <PageHeader title="Users & access" description="Every account: edit profiles, reset sign-in, block, and switch into an account to see what they see." />
      <nav aria-label="Filter" className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k.key}
            href={`/admin/users?kind=${k.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={k.key === kind ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              k.key === kind ? "border-foreground bg-foreground text-white" : "border-border bg-surface hover:border-foreground",
            )}
          >
            {k.label}
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2" role="search">
        <input type="hidden" name="kind" value={kind} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email or phone"
          aria-label="Search users"
          className="h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          Search
        </Button>
      </form>
      {items.length === 0 ? (
        <EmptyState title="No accounts found" />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Access</th>
                  <th className="px-4 py-2 font-medium">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                        {u.name}
                      </Link>
                      <p className="text-xs text-muted">joined {formatDate(u.createdAt)}</p>
                    </td>
                    <td className="px-4 py-2">{[u.phoneNumber, u.email].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        {u.roles.length ? (
                          u.roles.map((r) => (
                            <Badge key={r.role.key} tone="primary">
                              {r.role.name}
                            </Badge>
                          ))
                        ) : (
                          <Badge>Customer</Badge>
                        )}
                        {u.staffProfile && !u.staffProfile.active && <Badge>Deactivated</Badge>}
                        {u.blockedAt && <Badge tone="danger">Blocked</Badge>}
                        {!u.authUserId && <Badge tone="warning">No Supabase login yet</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-2">{u.lastSignInAt ? formatDate(u.lastSignInAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/users" params={{ q, kind }} />
        </>
      )}
    </>
  );
}
