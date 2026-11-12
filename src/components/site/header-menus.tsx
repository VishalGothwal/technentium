"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, ChevronRight, Clock, MapPin, Menu, Phone, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { HEADER_ICON_BUTTON, NavIcon, type NavIconName } from "./nav-icons";

type Href = { href: string; label: string };
export type MegaColumn = Href & {
  icon: NavIconName;
  meta: string;
  links: Href[];
};
export type NavEntry = Href & {
  key: string;
  icon: NavIconName;
  description?: string;
  mega?: {
    title: string;
    body?: string;
    all: Href;
    columns: MegaColumn[];
    feature: { title: string; body: string; points?: string[]; href: string; cta: string };
  };
};

/** Closes a menu when one of its links is followed (covers query-only navigations that keep the pathname). */
const closeOnLink = (close: () => void) => (e: React.MouseEvent) => {
  if ((e.target as Element).closest("a")) close();
};

export function DesktopNav({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navRef = useRef<HTMLElement>(null);

  const schedule = (key: string | null, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(key), delay);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="hidden self-stretch lg:flex"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(null);
          navRef.current?.querySelector<HTMLElement>(`[data-trigger="${open}"]`)?.focus();
        }
      }}
    >
      <ul className="flex items-stretch xl:gap-1">
        {entries.map((entry) => {
          const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
          const isOpen = open === entry.key;
          const indicator = (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0.5 top-1/2 -z-10 h-9 -translate-y-1/2 rounded-full bg-foreground/7 transition duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                active || isOpen ? "scale-100 opacity-100" : "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-60",
              )}
            />
          );
          const triggerClass = cn(
            "relative flex h-full items-center gap-1 px-2 text-sm font-semibold whitespace-nowrap transition-colors xl:px-3",
            active || isOpen ? "text-foreground" : "text-muted hover:text-foreground",
          );

          if (!entry.mega) {
            return (
              <li key={entry.key} className="flex">
                <Link href={entry.href} aria-current={active ? "page" : undefined} className={cn(triggerClass, "group isolate")}>
                  {entry.label}
                  {indicator}
                </Link>
              </li>
            );
          }

          return (
            <li
              key={entry.key}
              className="flex"
              onPointerEnter={(e) => e.pointerType === "mouse" && schedule(entry.key, open ? 0 : 90)}
              onPointerLeave={(e) => e.pointerType === "mouse" && schedule(null, 160)}
            >
              {/* Label navigates to the section; the chevron opens the panel for keyboard and touch users. */}
              <div className="group relative isolate flex">
                <Link
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    clearTimeout(timer.current);
                    setOpen(null);
                  }}
                  className={cn(triggerClass, "pr-0.5 xl:pr-1")}
                >
                  {entry.label}
                </Link>
                <button
                  type="button"
                  data-trigger={entry.key}
                  aria-expanded={isOpen}
                  aria-controls={`mega-${entry.key}`}
                  aria-label={entry.mega.title}
                  onClick={() => {
                    clearTimeout(timer.current);
                    setOpen(isOpen ? null : entry.key);
                  }}
                  className={cn(triggerClass, "pl-0.5 xl:pl-1")}
                >
                  <ChevronDown aria-hidden className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                </button>
                {indicator}
              </div>
              <div
                id={`mega-${entry.key}`}
                inert={!isOpen}
                onClick={closeOnLink(() => setOpen(null))}
                className={cn(
                  "absolute inset-x-0 top-full origin-top border-b border-border bg-surface/95 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)] backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  isOpen ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-[0.99] opacity-0",
                )}
              >
                <MegaPanel mega={entry.mega} />
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MegaPanel({ mega }: { mega: NonNullable<NavEntry["mega"]> }) {
  const nested = mega.columns.some((c) => c.links.length > 0);
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[1fr_17rem] gap-8 px-4 py-8 xl:grid-cols-[1fr_19rem] xl:gap-10">
      <div>
        <div className="mb-6 flex items-end justify-between gap-6 border-b border-border pb-4">
          <div>
            <p className="font-display text-xl font-bold tracking-tight">{mega.title}</p>
            {mega.body && <p className="mt-1 text-sm text-muted">{mega.body}</p>}
          </div>
          <Link href={mega.all.href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
            {mega.all.label}
            <ArrowRight aria-hidden className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
        <ul className={cn("grid gap-x-6", nested ? "grid-cols-3 gap-y-7" : "grid-cols-2 gap-y-1")}>
          {mega.columns.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="group -m-2 flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface-muted">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface transition group-hover:border-foreground group-hover:bg-foreground group-hover:text-white">
                  <NavIcon name={c.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.label}</span>
                  <span className="block text-xs text-muted">{c.meta}</span>
                </span>
              </Link>
              {c.links.length > 0 && (
                <ul className="mt-3 ml-13 space-y-1.5 text-sm">
                  {c.links.map((b) => (
                    <li key={b.href}>
                      <Link href={b.href} className="text-muted transition hover:text-foreground hover:underline">
                        {b.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Feature {...mega.feature} />
    </div>
  );
}

function Feature({ title, body, points, href, cta }: NonNullable<NavEntry["mega"]>["feature"]) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl bg-black p-6 text-white">
      <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-2xl" />
      <p className="relative font-display text-2xl leading-tight font-bold tracking-tight">{title}</p>
      <p className="relative mt-2 text-sm leading-relaxed text-white/70">{body}</p>
      {points && (
        <ul className="relative mt-5 space-y-2.5 text-sm font-medium">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-black">
                <Check aria-hidden className="size-3" strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      )}
      <div aria-hidden className="min-h-6 flex-1" />
      <Link
        href={href}
        className="relative inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
      >
        {cta}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

/** Full-height sheet on the native <dialog> (focus trap, Esc, inert page) for phones and tablets. */
export function MobileMenu({
  entries,
  logo,
  labels,
  book,
  track,
  contact,
  account,
  language,
}: {
  entries: NavEntry[];
  logo: ReactNode;
  labels: { open: string; close: string; menu: string; needHelp: string };
  book: Href & { body: string };
  track: Href & { description: string };
  contact: {
    tel: string | null;
    phone: string | null;
    hours: string;
    area: string;
  };
  account: ReactNode;
  language: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(HEADER_ICON_BUTTON, "lg:hidden")}
      >
        <Menu aria-hidden className="size-6" strokeWidth={1.75} />
      </button>
      <dialog
        ref={ref}
        aria-label={labels.menu}
        onClose={close}
        onClick={(e) => {
          if (e.target === ref.current) close();
          else closeOnLink(close)(e);
        }}
        className="menu-sheet m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-surface p-0 text-foreground backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex open:flex-col lg:hidden"
      >
        {open && (
          <>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              {logo}
              <button type="button" onClick={close} aria-label={labels.close} className={HEADER_ICON_BUTTON} autoFocus>
                <X aria-hidden className="size-6" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
              <Link href={book.href} className="rise group relative block overflow-hidden rounded-2xl bg-black p-5 text-white">
                <div aria-hidden className="absolute -top-12 -right-12 size-36 rounded-full bg-white/10 blur-2xl" />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="font-display text-xl font-bold tracking-tight">{book.label}</span>
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-black transition group-active:scale-95">
                    <ArrowRight aria-hidden className="size-4" />
                  </span>
                </span>
                <span className="relative mt-1.5 block text-sm text-white/70">{book.body}</span>
              </Link>

              <ul className="mt-5 divide-y divide-border border-y border-border">
                {entries.map((entry, i) => {
                  const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
                  return <li key={entry.key} className="rise" style={{ "--i": i + 2 } as CSSProperties}>{entry.mega ? <MobileSection entry={entry} active={active} /> : <MobileRow {...entry} active={active} />}</li>;
                })}
                <li>
                  <MobileRow href={track.href} label={track.label} description={track.description} icon="track" active={pathname.startsWith(track.href)} />
                </li>
              </ul>

              <div className="mt-5">{account}</div>
            </div>

            <div className="shrink-0 space-y-3 border-t border-border bg-surface-muted px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{labels.needHelp}</p>
                {language}
              </div>
              {contact.tel && contact.phone && (
                <a
                  href={contact.tel}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-foreground bg-surface text-sm font-semibold"
                >
                  <Phone aria-hidden className="size-4" />
                  {contact.phone}
                </a>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden className="size-3.5" />
                  {contact.hours}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-3.5" />
                  {contact.area}
                </span>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

function MobileRow({ href, label, description, icon, active }: Href & { description?: string; icon: NavIconName; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className="flex items-center gap-3 py-3.5">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-foreground text-white" : "bg-surface-muted")}>
        <NavIcon name={icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {description && <span className="block truncate text-xs text-muted">{description}</span>}
      </span>
      <ChevronRight aria-hidden className="size-4 text-muted" />
    </Link>
  );
}

function MobileSection({ entry, active }: { entry: NavEntry; active: boolean }) {
  const mega = entry.mega!;
  const [expanded, setExpanded] = useState(active);
  const panelId = `mobile-${entry.key}`;
  return (
    <div>
      {/* The row opens the section page; the chevron expands its categories in place. */}
      <div className="flex items-center gap-1">
        <Link href={entry.href} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-3.5">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-foreground text-white" : "bg-surface-muted")}>
            <NavIcon name={entry.icon} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{entry.label}</span>
            <span className="block truncate text-xs text-muted">{mega.title}</span>
          </span>
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={mega.title}
          onClick={() => setExpanded((v) => !v)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted"
        >
          <ChevronDown aria-hidden className={cn("size-5 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      <div id={panelId} hidden={!expanded} className="pb-4">
        <ul className="grid grid-cols-2 gap-2">
          {mega.columns.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="flex h-full flex-col gap-2 rounded-xl border border-border p-3 transition active:bg-surface-muted">
                <NavIcon name={c.icon} className="size-5" />
                <span className="text-sm leading-tight font-semibold">{c.label}</span>
                <span className="mt-auto text-xs text-muted">{c.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href={mega.all.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
          {mega.all.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  );
}
