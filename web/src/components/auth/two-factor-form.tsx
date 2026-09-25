"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postJson } from "@/lib/api";

type Challenge = {
  purpose: "verify" | "enroll";
  displayName: string;
  enrolled: boolean;
};

type Setup = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

export function TwoFactorForm() {
  const t = useT();
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getJson<Challenge>("/api/v1/auth/two-factor/challenge")
      .then(async (data) => {
        setChallenge(data);
        if (data.purpose === "enroll") {
          setSetup(await postJson<Setup>("/api/v1/auth/two-factor/setup", {}));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Sign in again");
      });
  }, []);

  if (recoveryCodes) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-brand">{t("auth.2fa_recovery_title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("auth.2fa_recovery_text")}</p>
        <ul className="mt-6 grid gap-2 font-mono text-sm font-bold text-brand">
          {recoveryCodes.map((code) => (
            <li key={code} className="rounded-2xl bg-mint px-4 py-2">
              {code}
            </li>
          ))}
        </ul>
        <Button
          className="mt-6 w-full"
          onClick={() => {
            router.push("/staff");
            router.refresh();
          }}
        >
          {t("auth.2fa_continue_staff")}
        </Button>
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
        const code = String(form.get("code") ?? "");
        try {
          if (challenge?.purpose === "enroll") {
            const result = await postJson<{ recoveryCodes: string[] }>(
              "/api/v1/auth/two-factor/confirm",
              { code },
            );
            setRecoveryCodes(result.recoveryCodes);
          } else {
            await postJson("/api/v1/auth/two-factor", { code });
            router.push("/staff");
            router.refresh();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not verify");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold text-brand">
        {challenge?.purpose === "enroll"
          ? t("auth.2fa_enroll_title")
          : t("auth.2fa_verify_title")}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {challenge?.purpose === "enroll"
          ? t("auth.2fa_enroll_text")
          : t("auth.2fa_verify_text")}
      </p>
      {setup ? (
        <div className="mt-6 rounded-[1.5rem] bg-mint p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrDataUrl}
            alt={t("auth.2fa_qr")}
            className="mx-auto h-44 w-44 rounded-2xl bg-white p-2"
          />
          <p className="mt-3 text-xs font-bold break-all text-brand">
            {setup.secret}
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}{" "}
          <Link href="/login" className="underline">
            {t("auth.2fa_return")}
          </Link>
        </p>
      ) : null}
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          {t("auth.2fa_code")}
        </span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={6}
          className={fieldClass}
        />
      </label>
      <Button type="submit" className="mt-6 w-full" disabled={pending || !challenge}>
        {pending ? t("auth.2fa_checking") : t("common.continue")}
      </Button>
    </form>
  );
}
