"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
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
        await authClient.signOut();
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
