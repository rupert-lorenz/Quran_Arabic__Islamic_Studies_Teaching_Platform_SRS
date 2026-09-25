"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import { signedInPath } from "@/lib/auth-home";

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const form = new FormData(event.currentTarget);
        try {
          const result = await postJson<{
            user: { roleKey: string; onboardingRequired?: boolean };
            twoFactor?: { required: boolean; enrolled: boolean };
          }>("/api/v1/auth/login", {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          });
          if (result.twoFactor?.required) {
            router.push("/login/two-factor");
          } else {
            router.push(signedInPath(result.user));
          }
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not sign in");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold text-brand">{t("auth.welcome")}</h1>
      <p className="mt-2 text-sm text-muted">{t("auth.welcome_text")}</p>
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
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("common.password")}</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </label>
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? t("auth.signing_in") : t("nav.login")}
      </Button>
      <p className="mt-4 text-center text-sm font-semibold">
        <Link href="/forgot-password" className="text-brand underline">
          {t("auth.forgot")}
        </Link>
      </p>
    </form>
  );
}
