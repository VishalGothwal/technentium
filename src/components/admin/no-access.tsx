import { EmptyState } from "@/components/ui/surface";

/** Shown when a staff member opens an admin area their role doesn't include (the services also enforce this). */
export function NoAccess() {
  return <EmptyState title="You don't have access to this area" description="Ask the Owner if your role should include it." />;
}
