"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/app/[locale]/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ label, className, redirectTo = "/" }: { label: string; className?: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      pending={pending}
      onClick={async () => {
        setPending(true);
        await signOutAction();
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
