import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/surface";
import { AdminShell } from "@/components/admin/shell";

// Same console frame as (console), but this group holds the Security page, which stays open while an
// owner without two-factor sign-in is locked out of everything else (so they can turn it on).
export const instant = false;

export default function SecurityLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
      <AdminShell twoFactorSetup>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </AdminShell>
    </Suspense>
  );
}
