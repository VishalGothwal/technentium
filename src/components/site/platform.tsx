import type { ReactNode } from "react";
import { getActor, getRealActor } from "@/server/auth/session";
import { cachedFeatures, type Section } from "@/server/features";
import { getT } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/button";
import { StopViewAsButton } from "@/components/admin/users/view-as";

/** Thin strip on every customer page while the Owner has test mode on. */
export async function TestModeStrip() {
  const { t } = await getT();
  return <p className="bg-warning px-4 py-1.5 text-center text-xs font-semibold text-black">{t("platform.testMode")}</p>;
}

/** Shown while an admin is switched into a customer's account ("view as"). Dynamic: render inside Suspense. */
export async function ViewAsBar() {
  const actor = await getActor();
  if (!actor?.impersonator) return null;
  const { t } = await getT();
  return (
    <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-warning px-4 py-2 text-sm font-medium text-black">
      <span>
        {t("platform.viewingAs", {
          name: actor.name,
          admin: actor.impersonator.name,
        })}
      </span>
      <StopViewAsButton returnTo={`/admin/users/${actor.userId}`} />
    </div>
  );
}

export async function MaintenanceNotice({ message }: { message: string }) {
  const { t } = await getT();
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{t("common.brand")}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("platform.maintenanceTitle")}</h1>
      <p className="mt-3 text-muted">{message || t("platform.maintenanceBody")}</p>
    </section>
  );
}

/** Maintenance mode: customers see the notice; signed-in staff see the site with a reminder. Dynamic: render inside Suspense. */
export async function MaintenanceGate({ message, children }: { message: string; children: ReactNode }) {
  const real = await getRealActor();
  if (!real?.isStaff) return <MaintenanceNotice message={message} />;
  const { t } = await getT();
  return (
    <>
      <p className="bg-danger px-4 py-1.5 text-center text-xs font-semibold text-white">{t("platform.staffMaintenance")}</p>
      {children}
    </>
  );
}

/** Wraps a site section; when the Owner switches it off, visitors get a friendly notice instead. */
export async function SectionGate({ section, children }: { section: Section; children: ReactNode }) {
  const features = await cachedFeatures();
  if (features.sections[section]) return children;
  const { t, locale } = await getT();
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{t("platform.sectionOffTitle")}</h1>
      <p className="mt-3 text-muted">{t("platform.sectionOffBody")}</p>
      <ButtonLink href={`/${locale}`} variant="secondary" className="mt-6">
        {t("platform.backHome")}
      </ButtonLink>
    </section>
  );
}
