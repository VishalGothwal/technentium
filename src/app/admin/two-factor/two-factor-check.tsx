"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyTotpAction } from "@/app/admin/(security)/security/actions";
import { TotpCodeField } from "@/components/admin/security/security-client";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";

export function TwoFactorCheck() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await verifyTotpAction(String(new FormData(e.currentTarget).get("code")));
        setPending(false);
        if (!res.ok)
          return setError(res.error === "auth.tooMany" ? "Too many attempts. Wait a few minutes and try again." : "That code didn't match. Check the time on your phone and try the current code.");
        router.replace("/admin");
        router.refresh();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <TotpCodeField />
      <Button type="submit" pending={pending} className="w-full">
        Continue
      </Button>
      <SignOutButton label="Use a different account" redirectTo="/admin/sign-in" className="w-full" />
    </form>
  );
}
