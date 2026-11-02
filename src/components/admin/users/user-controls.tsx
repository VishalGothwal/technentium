"use client";
import { useState } from "react";
import {
  resetTwoFactorAction,
  sendPasswordResetAction,
  setTemporaryPasswordAction,
  setUserBlockedAction,
  signOutEverywhereAction,
  updateUserProfileAction,
} from "@/app/admin/(console)/users/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";

type Profile = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  preferredLocale: string;
  displayName: string | null;
};

/** Edit any account's name, contact details and language. Contact changes apply to the Supabase login too. */
export function UserProfileForm({ user }: { user: Profile }) {
  const { run, pending, error, fields } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSaved(false);
        run(
          () =>
            updateUserProfileAction(user.id, {
              name: f.get("name"),
              email: f.get("email"),
              phoneNumber: f.get("phoneNumber"),
              preferredLocale: f.get("preferredLocale"),
              ...(user.displayName !== null ? { displayName: f.get("displayName") } : {}),
            }),
          () => setSaved(true),
        );
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Profile saved.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={fields.name} required>
          {(p) => <Input {...p} name="name" defaultValue={user.name} />}
        </Field>
        {user.displayName !== null && (
          <Field label="Display name (console)" error={fields.displayName}>
            {(p) => <Input {...p} name="displayName" defaultValue={user.displayName ?? ""} />}
          </Field>
        )}
        <Field label="Email" hint="Saved as confirmed — no email is sent." error={fields.email}>
          {(p) => <Input {...p} name="email" type="email" defaultValue={user.email ?? ""} />}
        </Field>
        <Field label="Mobile number" hint="Indian mobile, e.g. 98765 43210." error={fields.phoneNumber}>
          {(p) => <Input {...p} name="phoneNumber" inputMode="tel" defaultValue={user.phoneNumber ?? ""} />}
        </Field>
        <Field label="Language" error={fields.preferredLocale}>
          {(p) => (
            <Select {...p} name="preferredLocale" defaultValue={user.preferredLocale}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" pending={pending}>
        Save profile
      </Button>
    </form>
  );
}

type Access = {
  id: string;
  name: string;
  blocked: boolean;
  hasEmail: boolean;
  twoFactor: boolean;
  isSelf: boolean;
  linked: boolean;
  adminConfigured: boolean;
};

/** Block, passwords, sessions and two-factor for one account. Each action is audited. */
export function UserAccessControls({ user }: { user: Access }) {
  const { run, pending, error } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"block" | "password" | null>(null);
  const act = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; messageKey: string; fields?: Record<string, string> }>, message: string) =>
    run(fn, () => {
      setDone(message);
      setDialog(null);
    });

  return (
    <div className="space-y-3">
      {!user.adminConfigured && <Alert tone="warning">Set SUPABASE_SECRET_KEY to enable password, two-factor and block controls for Supabase logins.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      <div className="flex flex-wrap gap-2">
        {user.hasEmail && (
          <Button size="sm" variant="secondary" pending={pending} onClick={() => act(() => sendPasswordResetAction(user.id), "Password reset email sent.")}>
            Email reset link
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setDialog("password")}>
          {user.linked ? "Set password" : "Create login with password"}
        </Button>
        <Button size="sm" variant="secondary" pending={pending} onClick={() => act(() => signOutEverywhereAction(user.id), "Signed out on every device.")}>
          Sign out everywhere
        </Button>
        {user.twoFactor && (
          <Button
            size="sm"
            variant="secondary"
            pending={pending}
            onClick={() => act(() => resetTwoFactorAction(user.id), "Two-factor removed. They can set it up again from Security.")}
          >
            Reset two-factor
          </Button>
        )}
        {!user.isSelf &&
          (user.blocked ? (
            <Button size="sm" variant="secondary" pending={pending} onClick={() => act(() => setUserBlockedAction(user.id, false), "Account unblocked.")}>
              Unblock
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setDialog("block")}>
              Block account
            </Button>
          ))}
      </div>

      <Dialog
        open={dialog === "block"}
        onClose={() => setDialog(null)}
        title={`Block ${user.name}?`}
        description="They are signed out everywhere at once and can't sign in or use the app until unblocked."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            act(() => setUserBlockedAction(user.id, true, reason), "Account blocked.");
          }}
        >
          <Field label="Reason (internal)">{(p) => <Textarea {...p} name="reason" rows={2} maxLength={300} />}</Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" pending={pending}>
              Block
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "password"}
        onClose={() => setDialog(null)}
        title="Set a password"
        description="Useful for test accounts. Share it privately; they can change it after signing in."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const password = String(new FormData(e.currentTarget).get("password") ?? "");
            act(() => setTemporaryPasswordAction(user.id, password), "Password set.");
          }}
        >
          <Field label="New password" hint="At least 8 characters." required>
            {(p) => <Input {...p} name="password" type="text" autoComplete="off" minLength={8} maxLength={128} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Set password
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
