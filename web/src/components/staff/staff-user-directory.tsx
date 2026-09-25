"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, postJson } from "@/lib/api";
import {
  allRoleKeys,
  assignableStaffRoles,
  formatRoleKey,
  isStaffRole,
  type RoleKey,
} from "@/lib/rbac";

export type DirectoryUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roleKey: RoleKey | string;
  emailVerified: boolean;
  customPermissions?: boolean;
};

export function StaffUserDirectory({
  users: initialUsers,
  actorUserId,
  actorRoleKey,
  canWrite,
  canSuspend,
  canConfigurePermissions,
  superAdminCount,
}: {
  users: DirectoryUser[];
  actorUserId: string;
  actorRoleKey: string;
  canWrite: boolean;
  canSuspend: boolean;
  canConfigurePermissions: boolean;
  superAdminCount: number;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const createRoles = assignableStaffRoles(actorRoleKey);

  async function applyUpdate(id: string, body: Record<string, string>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const updated = await patchJson<DirectoryUser>(
        `/api/v1/staff/users/${id}`,
        body,
      );
      setUsers((current) =>
        current.map((user) => (user.id === id ? updated : user)),
      );
      setMessage("Account updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {canWrite ? (
        <form
          className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              const created = await postJson<DirectoryUser>("/api/v1/staff/users", {
                displayName: String(form.get("displayName") ?? ""),
                email: String(form.get("email") ?? ""),
                password: String(form.get("password") ?? ""),
                roleKey: String(form.get("roleKey") ?? "admin"),
              });
              setUsers((current) => [created, ...current]);
              event.currentTarget.reset();
              setMessage("Staff account created. They must set up two-factor authentication at first sign-in.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="text-xl font-extrabold text-brand">Create staff account</h2>
          <p className="mt-2 text-sm text-muted">
            Assign Accounts, Marketing, Academic, or Safeguarding for their
            dedicated workspace. New staff sign in, then enroll an authenticator.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Name</span>
              <input name="displayName" required minLength={2} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Email</span>
              <input type="email" name="email" required className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                Temporary password
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Role</span>
              <select name="roleKey" className={fieldClass} defaultValue="admin">
                {createRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatRoleKey(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? "Saving…" : "Create staff account"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-[2rem] border border-line bg-surface">
        <table className="min-w-full text-start text-sm">
          <thead className="bg-mint/70 text-brand">
            <tr>
              <th className="px-4 py-3 font-extrabold">Name</th>
              <th className="px-4 py-3 font-extrabold">Email</th>
              <th className="px-4 py-3 font-extrabold">Role</th>
              <th className="px-4 py-3 font-extrabold">Status</th>
              {canConfigurePermissions || canSuspend ? (
                <th className="px-4 py-3 font-extrabold">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const lastSuperAdmin =
                user.roleKey === "super_admin" &&
                user.status === "active" &&
                superAdminCount <= 1;
              const lockedSuperAdmin =
                user.roleKey === "super_admin" && actorRoleKey !== "super_admin";

              return (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3 font-bold text-brand">
                    {user.displayName}
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    {canWrite && user.id !== actorUserId && !lockedSuperAdmin ? (
                      <select
                        className="min-h-10 rounded-xl border border-line bg-background px-2 font-semibold"
                        value={user.roleKey}
                        disabled={pending || lastSuperAdmin}
                        onChange={(event) =>
                          applyUpdate(user.id, { roleKey: event.target.value })
                        }
                      >
                        {allRoleKeys
                          .filter(
                            (role) =>
                              role !== "super_admin" || actorRoleKey === "super_admin",
                          )
                          .map((role) => (
                            <option key={role} value={role}>
                              {formatRoleKey(role)}
                            </option>
                          ))}
                      </select>
                    ) : (
                      formatRoleKey(user.roleKey)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.status}
                    {user.customPermissions ? (
                      <span className="mt-1 block text-xs font-bold text-brand-soft">
                        Custom permissions
                      </span>
                    ) : null}
                  </td>
                  {canConfigurePermissions || canSuspend ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canConfigurePermissions &&
                        isStaffRole(user.roleKey) &&
                        user.roleKey !== "super_admin" ? (
                          <Link
                            href={`/staff/users/${user.id}/permissions`}
                            className="inline-flex min-h-10 items-center rounded-full bg-surface px-3 text-xs font-bold text-brand"
                          >
                            Permissions
                          </Link>
                        ) : null}
                        {canSuspend ? (
                          user.id === actorUserId ||
                          lastSuperAdmin ||
                          lockedSuperAdmin ? (
                            <span className="text-xs font-semibold text-muted">
                              Protected
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              disabled={pending}
                              onClick={() =>
                                applyUpdate(user.id, {
                                  status:
                                    user.status === "suspended"
                                      ? "active"
                                      : "suspended",
                                })
                              }
                            >
                              {user.status === "suspended" ? "Restore" : "Suspend"}
                            </Button>
                          )
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
