import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/surface";
import { AdminShell } from "@/components/admin/shell";

// Every console page is per-user and permission-dependent.
export const instant = false;

export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
      <AdminShell>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </AdminShell>
    </Suspense>
  );
}
