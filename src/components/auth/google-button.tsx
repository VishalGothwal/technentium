"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

/** True when the server has Google OAuth credentials (inlined at build time from next.config `env`). */
export const googleSignInEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "1";

/** One-tap "Continue with Google"; returns to the current page (or `callbackURL`) signed in. */
export function GoogleButton({ callbackURL }: { callbackURL?: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        block
        size="lg"
        pending={pending}
        className="rounded-xl border-foreground/20 font-semibold"
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await authClient.signIn.social({ provider: "google", callbackURL: callbackURL ?? window.location.href });
          // On success the browser is redirected to Google; we only get here on failure.
          if (res.error) {
            setPending(false);
            setError(t("auth.googleFailed"));
          }
        }}
      >
        {!pending && (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.3Z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2A11 11 0 0 0 1 12c0 1.8.4 3.4 1.2 4.9L5.7 14Z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.7 3.4-4.6 6.3-4.6Z" />
          </svg>
        )}
        {t("auth.continueGoogle")}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
