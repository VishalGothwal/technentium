"use client";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";

/** Unexpected errors in a console page: keeps the admin shell and navigation. */
export default function ConsoleError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      title="This page couldn't be loaded"
      description="Try again. If it keeps failing, check the server logs or go back to the dashboard."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <ButtonLink href="/admin" variant="secondary">
            Dashboard
          </ButtonLink>
        </div>
      }
    />
  );
}
