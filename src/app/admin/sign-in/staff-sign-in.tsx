"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { staffGoogleSignInAction, staffSignInAction } from "./actions";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

const STAFF_ERRORS: Partial<Record<string, string>> = {
  "auth.tooMany": "Too many attempts. Wait a minute and try again.",
  "auth.notStaff": "This account doesn't have staff access. Ask the Owner to invite you.",
  "auth.blocked": "This account is blocked. Ask the Owner to unblock it.",
  "auth.emailNotVerified": "Confirm your email first: open the link in your invitation email.",
  "auth.notConfigured": "Sign-in isn't configured yet: set the Supabase environment variables.",
};

/** Errors the auth callback sends back after "Continue with Google" (?error=…). */
const CALLBACK_ERRORS: Partial<Record<string, string>> = {
  notStaff: STAFF_ERRORS["auth.notStaff"],
  signup: STAFF_ERRORS["auth.notStaff"],
  blocked: STAFF_ERRORS["auth.blocked"],
  link: "Google sign-in didn't complete. Please try again.",
};

/** Staff sign-in: Google, or email and password. */
export function StaffSignIn() {
  const router = useRouter();
  const callbackError = useSearchParams().get("error");
  const [error, setError] = useState<string | null>(callbackError ? (CALLBACK_ERRORS[callbackError] ?? null) : null);
  const [pending, setPending] = useState(false);

  const done = () => {
    router.replace("/admin");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <GoogleButton start={staffGoogleSignInAction} />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          const res = await staffSignInAction(String(form.get("email")), String(form.get("password")));
          setPending(false);
          if (!res.ok) return setError(STAFF_ERRORS[res.error] ?? "Email or password is incorrect.");
          done();
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email" required>
          {(p) => <Input {...p} name="email" type="text" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" />}
        </Field>
        <Field label="Password" required>
          {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/en/auth/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" block pending={pending}>
          Sign in
        </Button>
        <p className="text-center text-xs text-muted">
          New staff accounts receive a set-password email from the Owner&apos;s invitation.
        </p>
      </form>
    </div>
  );
}
