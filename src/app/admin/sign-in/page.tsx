import { Suspense } from "react";
import { Logo } from "@/components/site/logo";
import { Skeleton } from "@/components/ui/surface";
import { StaffSignIn } from "./staff-sign-in";

export const metadata = { title: "Staff sign in" };

const POINTS = ["Booking queue and repair board", "Quotes, orders and custom designs", "Catalogue, estimates and content"];

export default function AdminSignInPage() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-black p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-2 font-semibold">
          <Logo tone="inverse" />
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-[0.14em] text-white/70 uppercase">Admin</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-5xl leading-[1.02] font-bold tracking-tight">Run the bench, the store and the stories.</p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-white/15 text-xs">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Staff console</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted">Use your Technentium staff account.</p>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-foreground/5">
            <Suspense fallback={<Skeleton className="h-40" />}>
              <StaffSignIn />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
