import type { ReactNode } from "react";
import { getT } from "@/i18n/server";

const BENEFITS = ["track", "orders", "designs", "secure"] as const;
type Benefit = (typeof BENEFITS)[number];
/** Brand panel text; the customer pages use the default from the message files. */
export type AuthPanel = { eyebrow: string; title: string; points: { icon: Benefit; title: string; body: string }[] };

function BenefitIcon({ k }: { k: Benefit }) {
  const paths: Record<Benefit, ReactNode> = {
    track: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    orders: (
      <>
        <path d="M3 7l9-4 9 4-9 4-9-4Z" />
        <path d="M3 7v10l9 4 9-4V7" />
      </>
    ),
    designs: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="8.5" cy="10" r="1.2" />
        <circle cx="12" cy="7.5" r="1.2" />
        <circle cx="15.5" cy="10" r="1.2" />
      </>
    ),
    secure: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[k]}
      </svg>
    </span>
  );
}

async function customerPanel(): Promise<AuthPanel> {
  const { t } = await getT();
  return { eyebrow: t("common.brand"), title: t("auth.panelTitle"), points: BENEFITS.map((k) => ({ icon: k, title: t(`auth.benefits.${k}.title`), body: t(`auth.benefits.${k}.body`) })) };
}

/** Split layout for sign-in, registration and password pages: brand panel (desktop) + form card. */
export async function AuthShell({ title, subtitle, children, footer, panel }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; panel?: AuthPanel }) {
  // getT() needs the customer site locale, so the admin sign-in (no locale) passes its own panel.
  const p = panel ?? (await customerPanel());
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-8 sm:py-12 lg:grid-cols-[1fr_28rem] lg:items-center lg:gap-12">
      <aside className="relative hidden overflow-hidden rounded-3xl bg-black p-10 text-white lg:block">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <p className="relative text-sm font-semibold uppercase tracking-widest text-white/70">{p.eyebrow}</p>
        <h2 className="relative mt-3 text-3xl font-bold leading-tight">{p.title}</h2>
        <ul className="relative mt-8 space-y-5">
          {p.points.map((pt) => (
            <li key={pt.title} className="flex gap-3">
              <BenefitIcon k={pt.icon} />
              <div>
                <p className="font-semibold">{pt.title}</p>
                <p className="text-sm text-white/75">{pt.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <div className="w-full min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
