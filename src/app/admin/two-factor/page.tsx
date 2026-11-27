import { redirect } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { getActor } from "@/server/auth/session";
import { TwoFactorCheck } from "./two-factor-check";

export const metadata = { title: "Two-factor check" };
export const instant = false;

/** After a staff password sign-in, when two-factor is on: the console opens only once the code is entered. */
export default async function TwoFactorPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/sign-in");
  if (!actor.mfaPending) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">Enter your code</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Open your authenticator app and enter the 6-digit code for Technentium.</p>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-foreground/5">
          <TwoFactorCheck />
        </div>
      </div>
    </div>
  );
}
