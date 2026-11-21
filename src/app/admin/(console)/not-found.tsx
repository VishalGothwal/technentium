import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";

/** Unknown or inaccessible records in the console (detail pages map FORBIDDEN to 404). */
export default function ConsoleNotFound() {
  return (
    <EmptyState
      title="Not found"
      description="This record doesn't exist, or your role can't open it."
      action={
        <ButtonLink href="/admin" variant="secondary">
          Dashboard
        </ButtonLink>
      }
    />
  );
}
