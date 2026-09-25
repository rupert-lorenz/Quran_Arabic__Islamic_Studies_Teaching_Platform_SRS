"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import { formatRoleKey } from "@/lib/rbac";

export type AdminAccount = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roleKey: string;
  customPermissions: boolean;
};

export function AdminAccountsPanel({
  admins: initialAdmins,
  canCreate,
}: {
  admins: AdminAccount[];
  canCreate: boolean;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div>
      {canCreate ? (
        <form
          className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              const created = await postJson<AdminAccount>("/api/v1/staff/users", {
                displayName: String(form.get("displayName") ?? ""),
                email: String(form.get("email") ?? ""),
                password: String(form.get("password") ?? ""),
                roleKey: "admin",
              });
              setAdmins((current) => [created, ...current]);
              event.currentTarget.reset();
              setMessage(
                "Admin account created. Configure their permissions below after they enroll two-factor authentication.",
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="text-xl font-extrabold text-brand">Create Admin</h2>
          <p className="mt-2 text-sm text-muted">
            New Admins inherit the Admin role until you save a custom set.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? "Saving…" : "Create Admin account"}
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

      {admins.length === 0 ? (
        <p className="mt-8 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          No Admin accounts yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-brand">
                    {admin.displayName}
                  </h2>
                  <p className="text-sm text-muted">
                    {admin.email} · {formatRoleKey(admin.roleKey)} · {admin.status}
                  </p>
                  <p className="mt-2 text-xs font-bold text-brand-soft">
                    {admin.customPermissions
                      ? "Custom permissions"
                      : "Uses Admin role defaults"}
                  </p>
                </div>
                <Link
                  href={`/staff/users/${admin.id}/permissions`}
                  className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-bold text-white"
                >
                  Configure permissions
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
