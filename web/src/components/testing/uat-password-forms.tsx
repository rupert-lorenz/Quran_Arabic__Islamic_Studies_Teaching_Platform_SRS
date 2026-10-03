"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { UiMessageKey } from "@/lib/i18n";
import type { getTestingFaculties } from "@/server/testing/faculties";

type Account = Awaited<ReturnType<typeof getTestingFaculties>>["uat"]["accounts"][number];

export function UatPasswordForms({ accounts }: { accounts: Account[] }) {
  const t = useT();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function save(roleKey: string, password: string) {
    setPending(roleKey);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/staff/testing/uat-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey, password }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: { message?: string } };
      setMessage(body.ok ? t("tq.uat.password.saved") : body.error?.message || t("tq.uat.password.failed"));
      if (body.ok) router.refresh();
    } catch {
      setMessage(t("tq.uat.password.failed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("tq.uat.password")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("tq.uat.password.help")}</p>
      <div className="mt-6 space-y-4">
        {accounts.map((account) => (
          <form
            key={account.id}
            className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const password = String(new FormData(event.currentTarget).get("password") ?? "");
              void save(account.id, password);
              event.currentTarget.reset();
            }}
          >
            <p className="text-sm font-bold text-brand">
              {t(`tq.role.${account.id}` as UiMessageKey)}
            </p>
            <label className="text-sm font-bold text-brand">
              {t("tq.uat.password")}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                className="mt-2 block w-full rounded-2xl border border-line px-4 py-2 font-normal"
              />
            </label>
            <Button type="submit" disabled={!account.ready || pending === account.id}>
              {t("tq.uat.password.save")}
            </Button>
          </form>
        ))}
      </div>
      {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
    </section>
  );
}
