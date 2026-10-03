"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";

export function RegisterBrowser() {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function register() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/mobile/devices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "web", appVersion: "web" }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      setMessage(
        body.ok ? t("mb.push.registered") : body.error?.message || t("mb.push.failed"),
      );
    } catch {
      setMessage(t("mb.push.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("mb.push.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("mb.push.help")}</p>
      <button
        type="button"
        onClick={register}
        disabled={pending}
        className="mt-4 rounded-full bg-brand-accent px-5 py-2 text-sm font-bold text-brand disabled:opacity-60"
      >
        {pending ? t("mb.push.working") : t("mb.push.register")}
      </button>
      {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
    </div>
  );
}
