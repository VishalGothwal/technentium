import { Suspense } from "react";
import { Logo } from "@/components/site/logo";
import { AuthShell, type AuthPanel } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/surface";
import { cachedAuthProviders } from "@/server/features";
import { StaffSignIn } from "./staff-sign-in";

export const metadata = { title: "Staff sign in" };

/** Same layout as the customer sign-in (AuthShell), with the staff console's own panel. */
const PANEL: AuthPanel = {
  eyebrow: "Staff console",
  title: "Run the bench, the store and the stories.",
  points: [
    { icon: "track", title: "Repairs", body: "Repair orders, jobs and the repair board." },
    { icon: "orders", title: "Protection store", body: "Product orders, stock and customers." },
    { icon: "designs", title: "Custom designs", body: "Design orders and the design catalogue." },
    { icon: "secure", title: "Secure access", body: "Roles, audit history and two-factor sign-in." },
  ],
};

/** The Google button shows only once Google is enabled in Supabase. */
async function StaffSignInForm() {
  const { google } = await cachedAuthProviders();
  return <StaffSignIn google={google} />;
}

export default function AdminSignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pt-6">
        <Logo />
        <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-[0.14em] text-muted uppercase">Admin</span>
      </div>
      <div className="flex flex-1 lg:items-center">
        <AuthShell title="Sign in" subtitle="Use your Technentium staff account." panel={PANEL}>
          <Suspense fallback={<Skeleton className="h-64" />}>
            <StaffSignInForm />
          </Suspense>
        </AuthShell>
      </div>
    </div>
  );
}
