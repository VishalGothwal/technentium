"use client";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/admin/use-action";
import { retryDeliveryAction } from "@/app/admin/actions";

export function RetryDeliveryButton({ id }: { id: string }) {
  const { run, pending, error } = useAction();
  return (
    <>
      <Button size="sm" variant="secondary" pending={pending} onClick={() => run(() => retryDeliveryAction(id))}>
        Retry
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  );
}
