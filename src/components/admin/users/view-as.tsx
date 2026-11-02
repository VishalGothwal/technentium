"use client";
import { useRouter } from "next/navigation";
import { startViewAsAction, stopViewAsAction } from "@/app/admin/(console)/users/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/admin/use-action";

/** "Switch to this user": staff targets open the console as them, customers open the storefront account. */
export function StartViewAsButton({
  userId,
  isStaff,
  size = "sm",
  variant = "secondary",
  label = "Switch to this user",
}: {
  userId: string;
  isStaff: boolean;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost" | "primary";
  label?: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size={size}
        variant={variant}
        pending={pending}
        onClick={() =>
          run(
            () => startViewAsAction(userId),
            () => {
              router.push(isStaff ? "/admin" : "/en/account");
              router.refresh();
            },
          )
        }
      >
        {label}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function StopViewAsButton({ returnTo, className }: { returnTo: string; className?: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <Button
      size="sm"
      variant="secondary"
      className={className}
      pending={pending}
      onClick={() =>
        run(
          () => stopViewAsAction(),
          () => {
            router.push(returnTo);
            router.refresh();
          },
        )
      }
    >
      Switch back
    </Button>
  );
}
