"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";

export function ForgotPasswordForm() {
  const t = useT();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ resetUrl?: string } | null>(null);

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-brand">{t("auth.check_email")}</h1>
        <p className="mt-3 text-sm text-muted">{t("auth.forgot_sent")}</p>
        {done.resetUrl ? (
          <p className="mt-4 text-sm font-semibold">
            <a href={done.resetUrl} className="text-brand underline">
              {t("auth.dev_reset")}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const form = new FormData(event.currentTarget);
        try {
          const data = await postJson<{ resetUrl?: string }>(
            "/api/v1/auth/forgot-password",
            { email: String(form.get("email") ?? "") },
          );
          setDone(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send reset");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold text-brand">{t("auth.forgot_title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("auth.forgot_text")}</p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("common.email")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={fieldClass}
        />
      </label>
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? t("auth.sending") : t("auth.send_reset")}
      </Button>
    </form>
  );
}
