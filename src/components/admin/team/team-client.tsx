"use client";
import { useState } from "react";
import type { RoleKey } from "@/server/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { inviteStaffAction, setStaffActiveAction, setStaffRolesAction } from "@/app/admin/actions";

type Role = { key: RoleKey; name: string; description: string };

function RoleCheckboxes({ roles, selected, onChange }: { roles: Role[]; selected: RoleKey[]; onChange: (r: RoleKey[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Roles</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((r) => (
          <Checkbox
            key={r.key}
            checked={selected.includes(r.key)}
            onChange={(e) => onChange(e.target.checked ? [...selected, r.key] : selected.filter((x) => x !== r.key))}
            label={
              <>
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-muted">{r.description}</span>
              </>
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

export function InviteStaffForm({ roles }: { roles: Role[] }) {
  const { run, pending, error, fields } = useAction();
  const [selected, setSelected] = useState<RoleKey[]>(["staff"]);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const email = String(f.get("email"));
        run(() => inviteStaffAction({ name: f.get("name"), email, roles: selected }), () => {
          setDone(`Invitation sent to ${email}.`);
          form.reset();
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fields.name} required>
          {(p) => <Input {...p} name="name" />}
        </Field>
        <Field label="Email" error={fields.email} required>
          {(p) => <Input {...p} name="email" type="email" />}
        </Field>
      </div>
      <RoleCheckboxes roles={roles} selected={selected} onChange={setSelected} />
      {fields.roles && <p className="text-sm text-danger">{fields.roles}</p>}
      <Button type="submit" pending={pending} disabled={selected.length === 0}>
        Send invitation
      </Button>
    </form>
  );
}

type Member = { id: string; name: string; email: string; phone: string | null; active: boolean; twoFactor: boolean; roles: RoleKey[] };

export function StaffRow({ member, roles, isSelf }: { member: Member; roles: Role[]; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<RoleKey[]>(member.roles);
  const rolesAction = useAction();
  const activeAction = useAction();
  const roleName = (k: RoleKey) => roles.find((r) => r.key === k)?.name ?? k;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            {member.name} {isSelf && <span className="text-muted">(you)</span>}
          </p>
          <p className="text-muted">{[member.email, member.phone].filter(Boolean).join(" · ")}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {member.roles.map((r) => (
              <Badge key={r} tone="primary">
                {roleName(r)}
              </Badge>
            ))}
            <Badge tone={member.active ? "success" : "neutral"}>{member.active ? "Active" : "Deactivated"}</Badge>
            <Badge tone={member.twoFactor ? "success" : "warning"}>{member.twoFactor ? "2FA on" : "2FA off"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" aria-expanded={editing} onClick={() => setEditing(!editing)}>
            {editing ? "Close" : "Edit roles"}
          </Button>
          {!isSelf && (
            <Button size="sm" variant={member.active ? "ghost" : "secondary"} onClick={() => setConfirm(true)}>
              {member.active ? "Deactivate" : "Reactivate"}
            </Button>
          )}
        </div>
      </div>
      {activeAction.error && <Alert tone="danger" className="mt-2">{activeAction.error}</Alert>}
      {editing && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-muted p-3">
          {rolesAction.error && <Alert tone="danger">{rolesAction.error}</Alert>}
          <RoleCheckboxes roles={roles} selected={selected} onChange={setSelected} />
          <Button size="sm" pending={rolesAction.pending} disabled={selected.length === 0} onClick={() => rolesAction.run(() => setStaffRolesAction(member.id, selected), () => setEditing(false))}>
            Save roles
          </Button>
        </div>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={member.active ? `Deactivate ${member.name}?` : `Reactivate ${member.name}?`}
        description={
          member.active
            ? "They will be signed out immediately, lose access to the admin console, and be unassigned from their open jobs."
            : "They will be able to sign in again with their existing roles."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant={member.active ? "danger" : "primary"}
            pending={activeAction.pending}
            onClick={() => activeAction.run(() => setStaffActiveAction(member.id, !member.active), () => setConfirm(false))}
          >
            {member.active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </Dialog>
    </li>
  );
}
