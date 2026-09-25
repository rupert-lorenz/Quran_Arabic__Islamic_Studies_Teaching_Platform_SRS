"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { putJson } from "@/lib/api";
import { formatRoleKey } from "@/lib/rbac";

type Permission = {
  key: string;
  name: string;
  group: string;
};

export type AccountPermissionState = {
  userId: string;
  displayName: string;
  email: string;
  roleKey: string;
  locked: boolean;
  mode: "role" | "custom";
  rolePermissions: string[];
  permissions: string[];
  catalog: Permission[];
};

export function AccountPermissionEditor({
  initial,
  canWrite,
}: {
  initial: AccountPermissionState;
  canWrite: boolean;
}) {
  const [state, setState] = useState(initial);
  const [mode, setMode] = useState(initial.mode);
  const [draft, setDraft] = useState(initial.permissions);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of state.catalog) {
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }
    return [...map.entries()];
  }, [state.catalog]);

  const assigned = new Set(
    mode === "role" ? state.rolePermissions : draft,
  );

  return (
    <div>
      <p className="text-sm text-muted">
        {state.displayName} · {state.email} · {formatRoleKey(state.roleKey)}
      </p>
      {state.locked ? (
        <p className="mt-4 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          Super Admin and marketplace accounts cannot have a custom permission set.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`inline-flex min-h-11 rounded-full px-4 text-sm font-bold ${
                mode === "role" ? "bg-brand text-white" : "bg-surface text-brand"
              }`}
              onClick={() => setMode("role")}
              disabled={!canWrite}
            >
              Role defaults
            </button>
            <button
              type="button"
              className={`inline-flex min-h-11 rounded-full px-4 text-sm font-bold ${
                mode === "custom" ? "bg-brand text-white" : "bg-surface text-brand"
              }`}
              onClick={() => {
                setDraft(mode === "role" ? state.rolePermissions : draft);
                setMode("custom");
              }}
              disabled={!canWrite}
            >
              Custom for this account
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            {mode === "role"
              ? "This account inherits whatever its role currently allows."
              : "Only the keys you save here apply to this account."}
          </p>
          <div className="mt-6 space-y-6">
            {groups.map(([group, items]) => (
              <section
                key={group}
                className="rounded-[2rem] border border-line bg-surface p-5"
              >
                <h2 className="text-lg font-extrabold text-brand capitalize">
                  {group}
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {items.map((permission) => (
                    <li key={permission.key}>
                      <label className="flex min-h-11 items-start gap-3 rounded-2xl px-2 py-1">
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          checked={assigned.has(permission.key)}
                          disabled={mode === "role" || !canWrite}
                          onChange={(event) => {
                            setDraft((current) => {
                              const next = new Set(current);
                              if (event.target.checked) {
                                next.add(permission.key);
                              } else {
                                next.delete(permission.key);
                              }
                              return [...next];
                            });
                          }}
                        />
                        <span>
                          <span className="block font-bold text-brand">
                            {permission.name}
                          </span>
                          <span className="block text-xs text-muted">
                            {permission.key}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {canWrite ? (
            <Button
              className="mt-6"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                setMessage("");
                try {
                  const saved = await putJson<AccountPermissionState>(
                    `/api/v1/staff/users/${state.userId}/permissions`,
                    {
                      mode,
                      keys: mode === "custom" ? draft : state.rolePermissions,
                    },
                  );
                  setState(saved);
                  setMode(saved.mode);
                  setDraft(saved.permissions);
                  setMessage(
                    saved.mode === "role"
                      ? "This account now follows its role defaults."
                      : "Custom permissions saved for this account.",
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not save");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Saving…" : "Save account permissions"}
            </Button>
          ) : null}
        </>
      )}
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
    </div>
  );
}
