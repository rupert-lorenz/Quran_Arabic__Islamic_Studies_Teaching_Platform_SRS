"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { putJson } from "@/lib/api";

type Permission = {
  key: string;
  name: string;
  group: string;
  description: string | null;
};

type Role = {
  key: string;
  name: string;
  description: string | null;
  locked: boolean;
  permissions: string[];
};

export function RoleMatrix({
  catalog,
  roles,
  canWrite,
}: {
  catalog: Permission[];
  roles: Role[];
  canWrite: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState(
    roles.find((role) => !role.locked)?.key ?? roles[0]?.key ?? "",
  );
  const [draft, setDraft] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(roles.map((role) => [role.key, role.permissions])),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const selected = roles.find((role) => role.key === selectedKey);
  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of catalog) {
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  if (!selected) {
    return <p className="text-muted">No roles are configured.</p>;
  }

  const assigned = new Set(draft[selected.key] ?? []);
  const locked = selected.locked;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => setSelectedKey(role.key)}
            className={`inline-flex min-h-11 rounded-full px-4 text-sm font-bold ${
              role.key === selectedKey
                ? "bg-brand text-white"
                : "bg-surface text-brand"
            }`}
          >
            {role.name}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        {selected.description ?? "Role permissions"}
        {locked ? " Super Admin always receives every permission." : null}
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
                      disabled={locked || !canWrite}
                      onChange={(event) => {
                        setDraft((current) => {
                          const next = new Set(current[selected.key] ?? []);
                          if (event.target.checked) {
                            next.add(permission.key);
                          } else {
                            next.delete(permission.key);
                          }
                          return { ...current, [selected.key]: [...next] };
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
      {canWrite && !locked ? (
        <Button
          className="mt-6"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            setMessage("");
            try {
              await putJson(`/api/v1/rbac/roles/${selected.key}/permissions`, {
                keys: draft[selected.key] ?? [],
              });
              setMessage(`Saved permissions for ${selected.name}.`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Saving…" : "Save role permissions"}
        </Button>
      ) : null}
      {!canWrite ? (
        <p className="mt-6 text-sm font-semibold text-muted">
          You can view the matrix. Changing it requires rbac.write.
        </p>
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
    </div>
  );
}
