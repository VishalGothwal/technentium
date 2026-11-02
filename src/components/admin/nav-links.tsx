"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavIcon =
  | "dashboard"
  | "inbox"
  | "wrench"
  | "board"
  | "bag"
  | "box"
  | "brush"
  | "palette"
  | "article"
  | "chart"
  | "users"
  | "devices"
  | "settings"
  | "bell"
  | "team"
  | "history"
  | "shield"
  | "key"
  | "toggle"
  | "profile";

export type NavLinkItem = { href: string; label: string; icon: NavIcon };
export type NavGroup = { label: string | null; items: NavLinkItem[] };

const PATHS: Record<NavIcon, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  inbox: "M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  board: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  bag: "M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0",
  box: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10",
  brush: "M14 4l6 6-8 8H6v-6zM6 18l-2 2",
  palette: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  article: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  users: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-3-3M17 5a3 3 0 0 1 0 6",
  devices: "M4 6h11v9H4zM2 18h15M18 8h4v12h-4z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.7H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bell: "M18 16V11a6 6 0 0 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0",
  team: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20v-1a6 6 0 0 1 12 0v1M16 4a3 3 0 0 1 0 6M21 20v-1a5 5 0 0 0-3-4.6",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4",
  key: "M15 7a4 4 0 1 1-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7zM16 9.5h.01",
  toggle: "M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7zM16 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a7 7 0 0 1 14 0v1",
};

export function NavGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-[1.1rem] shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[icon]} />
    </svg>
  );
}

/** Grouped sidebar navigation for the dark admin rail. The deepest matching link is marked current. */
export function AdminNavLinks({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const all = groups.flatMap((g) => g.items);
  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || (pathname.startsWith(`${href}/`) && !all.some((i) => i.href !== href && i.href.startsWith(href) && pathname.startsWith(i.href)));
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi}>
          {g.label && <p className="mb-1.5 px-3 text-[0.65rem] font-semibold tracking-[0.16em] text-white/40 uppercase">{g.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const on = active(i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      on ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {on && <span aria-hidden className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-white" />}
                    <NavGlyph icon={i.icon} className={on ? "text-white" : undefined} />
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
