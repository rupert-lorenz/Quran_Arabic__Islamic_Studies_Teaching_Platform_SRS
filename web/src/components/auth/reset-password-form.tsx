"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <p className="text-sm font-semibold text-brand">
        {t("auth.reset_missing")}{" "}
        <Link href="/forgot-password" className="underline">
          {t("auth.forgot")}
        </Link>
      </p>
    );
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-brand">{t("auth.reset_updated")}</h1>
        <p className="mt-3 text-sm text-muted">{t("auth.reset_sign_in")}</p>
        <Link href="/login" className="mt-6 inline-flex font-bold text-brand underline">
          {t("nav.login")}
        </Link>
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
          await postJson("/api/v1/auth/reset-password", {
            token,
            password: String(form.get("password") ?? ""),
          });
          setDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not reset password");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold text-brand">{t("auth.reset_title")}</h1>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("auth.new_password")}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={fieldClass}
        />
      </label>
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? t("auth.updating") : t("auth.update_password")}
      </Button>
    </form>
  );
}
