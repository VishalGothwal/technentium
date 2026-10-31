import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { can, type Actor } from "@/server/rbac/actor";
import type { Permission } from "@/server/rbac/permissions";
import { ROLE_DEFINITIONS } from "@/server/rbac/permissions";
import { Logo } from "@/components/site/logo";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Alert } from "@/components/ui/surface";
import { AdminNavLinks, type NavGroup, type NavIcon } from "./nav-links";

export type NavItem = { href: string; label: string; icon: NavIcon; anyOf: Permission[] };

const NAV: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ href: "/admin", label: "Dashboard", icon: "dashboard", anyOf: ["dashboard.view"] }] },
  {
    label: "Repairs",
    items: [
      { href: "/admin/bookings", label: "Booking queue", icon: "inbox", anyOf: ["booking.view_all"] },
      { href: "/admin/jobs", label: "Repair jobs", icon: "wrench", anyOf: ["job.view_all", "job.view_assigned"] },
      { href: "/admin/jobs/board", label: "Repair board", icon: "board", anyOf: ["job.view_all", "job.view_assigned"] },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/admin/orders", label: "Product requests", icon: "bag", anyOf: ["product_request.manage"] },
      { href: "/admin/products", label: "Products & stock", icon: "box", anyOf: ["product.manage", "inventory.manage"] },
      { href: "/admin/customization", label: "Custom designs", icon: "brush", anyOf: ["customization.manage", "customization.technical_input"] },
      { href: "/admin/designs", label: "Design catalogue", icon: "palette", anyOf: ["customization.manage"] },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content", label: "Articles & videos", icon: "article", anyOf: ["content.edit"] },
      { href: "/admin/specs", label: "Specs & comparisons", icon: "chart", anyOf: ["content.edit"] },
    ],
  },
  { label: "People", items: [{ href: "/admin/customers", label: "Customers", icon: "users", anyOf: ["customer.view"] }, { href: "/admin/team", label: "Team & roles", icon: "team", anyOf: ["team.manage"] }] },
  {
    label: "Configuration",
    items: [
      { href: "/admin/catalog", label: "Devices & pricing", icon: "devices", anyOf: ["catalog.manage", "settings.fees"] },
      { href: "/admin/settings", label: "Settings", icon: "settings", anyOf: ["settings.manage", "settings.fees"] },
      { href: "/admin/notifications", label: "Notification log", icon: "bell", anyOf: ["notification.view_log"] },
      { href: "/admin/audit", label: "Audit history", icon: "history", anyOf: ["audit.view_all", "audit.view_limited"] },
      { href: "/admin/security", label: "Security", icon: "shield", anyOf: ["dashboard.view"] },
    ],
  },
];

/** Owners must use two-factor sign-in (PRD §7.6). Enforced in production; flagged in development. */
async function ownerNeedsTwoFactor(actor: Actor) {
  if (!actor.roles.includes("owner")) return false;
  const user = await db.user.findUnique({ where: { id: actor.userId }, select: { twoFactorEnabled: true } });
  return !user?.twoFactorEnabled;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Staff console frame: dark grouped sidebar on desktop, dark top bar with a drawer on small screens. */
export async function AdminShell({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor || !actor.isStaff) redirect("/admin/sign-in");

  const needs2fa = await ownerNeedsTwoFactor(actor);
  const enforce2fa = needs2fa && process.env.NODE_ENV === "production";

  const groups: NavGroup[] = NAV.map((g) => ({
    label: g.label,
    items: g.items
      .filter((n) => n.anyOf.some((p) => can(actor, p)))
      .filter((n) => !enforce2fa || n.href === "/admin/security")
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((g) => g.items.length > 0);
  const roleNames = actor.roles.map((r) => ROLE_DEFINITIONS[r].name).join(", ");

  const sidebar = (
    <>
      <AdminNavLinks groups={groups} />
      <div className="mt-auto border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            {initials(actor.name ?? "")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{actor.name}</p>
            <p className="truncate text-xs text-white/50">{roleNames}</p>
          </div>
        </div>
        <SignOutButton label="Sign out" redirectTo="/admin/sign-in" className="mt-3 w-full justify-start text-white/70 hover:bg-white/10 hover:text-white" />
      </div>
    </>
  );

  const brand = (
    <Link href="/admin" className="flex items-center gap-2 font-semibold text-white">
      <Logo tone="inverse" />
      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-[0.14em] text-white/70 uppercase">Admin</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="hidden bg-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 shrink-0 items-center px-6">{brand}</div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{sidebar}</div>
      </aside>

      <div className="min-w-0">
        {/* Small screens: dark bar with a drawer holding the same navigation. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-foreground px-4 lg:hidden">
          <details className="group relative">
            <summary
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-white ring-1 ring-white/20 [&::-webkit-details-marker]:hidden"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="fixed inset-x-3 top-16 flex max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto rounded-2xl bg-foreground shadow-2xl ring-1 ring-white/10 sm:absolute sm:inset-x-auto sm:top-auto sm:mt-3 sm:w-72">
              {sidebar}
            </div>
          </details>
          {brand}
        </header>

        <div className="sticky top-0 z-10 hidden h-16 items-center justify-between border-b border-border bg-surface/85 px-6 backdrop-blur lg:flex">
          <p className="text-sm text-muted">
            Staff console · <span className="font-medium text-foreground">Technentium</span>
          </p>
          <Link href="/en" target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-foreground">
            View storefront
            <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 5h5v5M19 5l-8 8M10 5H5v14h14v-5" />
            </svg>
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
        </div>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {needs2fa && (
            <Alert tone="warning" className="mb-4" title="Two-factor authentication required">
              Owner accounts must enable two-factor sign-in.{" "}
              <Link href="/admin/security" className="underline">
                Set it up now
              </Link>
              {!enforce2fa && " (not enforced in development)."}
            </Alert>
          )}
          {enforce2fa ? <EnforcedSecurity /> : children}
        </main>
      </div>
    </div>
  );
}

function EnforcedSecurity() {
  return (
    <p className="text-sm text-muted">
      Other admin areas are locked until two-factor authentication is enabled. Open <Link href="/admin/security" className="underline">Security</Link>.
    </p>
  );
}
