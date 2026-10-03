"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import type { getSecurityFaculties } from "@/server/security/faculties";

type Faculties = Awaited<ReturnType<typeof getSecurityFaculties>>;

export function PrivacyControls({ faculties }: { faculties: Faculties }) {
  const t = useT();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function save(kind: "privacy" | "marketing", granted: boolean) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/security/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, granted }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      setMessage(body.ok ? t("sp.saved") : body.error?.message || t("sp.failed"));
      if (body.ok) router.refresh();
    } catch {
      setMessage(t("sp.failed"));
    } finally {
      setPending(false);
    }
  }

  async function removeAccount() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/security/deletion", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (body.ok) {
        router.push("/login");
        router.refresh();
        return;
      }
      setMessage(body.error?.message || t("sp.failed"));
    } catch {
      setMessage(t("sp.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("sp.privacy.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("sp.privacy.help")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => save("privacy", true)}
          className="rounded-full bg-brand-accent px-5 py-2 text-sm font-bold text-brand disabled:opacity-60"
        >
          {t("sp.privacy.accept")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save("privacy", false)}
          className="rounded-full border border-line px-5 py-2 text-sm font-bold text-brand disabled:opacity-60"
        >
          {t("sp.privacy.withdraw")}
        </button>
      </div>

      <h2 className="mt-8 font-heading text-xl font-bold tracking-tight text-brand">
        {t("sp.marketing.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("sp.marketing.help")}</p>
      {faculties.marketing.allowed ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => save("marketing", true)}
            className="rounded-full bg-brand-accent px-5 py-2 text-sm font-bold text-brand disabled:opacity-60"
          >
            {t("sp.marketing.optIn")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save("marketing", false)}
            className="rounded-full border border-line px-5 py-2 text-sm font-bold text-brand disabled:opacity-60"
          >
            {t("sp.marketing.optOut")}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("sp.marketing.blocked")}</p>
      )}

      <h2 className="mt-8 font-heading text-xl font-bold tracking-tight text-brand">
        {t("sp.retention.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("sp.delete.help")}</p>
      {faculties.children.parentManaged ? (
        <p className="mt-4 text-sm text-muted">{t("sp.delete.parent")}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={t("sp.delete.phrase")}
            className="rounded-2xl border border-line px-4 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || confirm !== "delete my account"}
            onClick={removeAccount}
            className="rounded-full border border-line px-5 py-2 text-sm font-bold text-brand disabled:opacity-60"
          >
            {t("sp.delete.button")}
          </button>
        </div>
      )}
      {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
    </section>
  );
}
