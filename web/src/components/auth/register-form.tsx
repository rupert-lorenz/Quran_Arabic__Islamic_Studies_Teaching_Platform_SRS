"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import { parentRelationships } from "@/lib/parent-profile";
import { studentLevels } from "@/lib/student-profile";

export function RegisterForm({
  defaultRole = "parent",
  countries = [],
}: {
  defaultRole?: "parent" | "student" | "teacher";
  countries?: { iso2: string; name: string }[];
}) {
  const t = useT();
  const [role, setRole] = useState(defaultRole);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ email: string; verifyUrl?: string } | null>(
    null,
  );

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-brand">{t("auth.check_email")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {t("auth.verify_sent", { email: done.email })}
        </p>
        {done.verifyUrl ? (
          <p className="mt-4 text-sm font-semibold">
            <a href={done.verifyUrl} className="text-brand underline">
              {t("auth.dev_verify")}
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
        const roleKey = String(form.get("roleKey") ?? "student");
        try {
          const payload: Record<string, string> = {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            displayName: String(form.get("displayName") ?? ""),
            roleKey,
          };
          if (roleKey === "student" || roleKey === "parent") {
            payload.dateOfBirth = String(form.get("dateOfBirth") ?? "");
            payload.country = String(form.get("country") ?? "");
          }
          if (roleKey === "student") {
            payload.currentLevel = String(form.get("currentLevel") ?? "");
          }
          if (roleKey === "parent") {
            payload.relationship = String(form.get("relationship") ?? "");
          }
          const data = await postJson<{ email: string; verifyUrl?: string }>(
            "/api/v1/auth/register",
            payload,
          );
          setDone(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not register");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold text-brand">{t("auth.register_title")}</h1>
      <p className="mt-2 text-sm text-muted">
        {role === "teacher"
          ? t("auth.register_teacher")
          : role === "student"
            ? t("auth.register_student")
            : t("auth.register_parent")}
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("auth.full_name")}</span>
        <input
          name="displayName"
          autoComplete="name"
          required
          minLength={2}
          className={fieldClass}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("auth.i_am")}</span>
        <select
          name="roleKey"
          className={fieldClass}
          value={role}
          onChange={(event) =>
            setRole(event.target.value as "parent" | "student" | "teacher")
          }
        >
          <option value="parent">{t("auth.role_parent")}</option>
          <option value="student">{t("auth.role_student")}</option>
          <option value="teacher">{t("auth.role_teacher")}</option>
        </select>
      </label>
      {role === "student" || role === "parent" ? (
        <>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold text-brand">
              {t("auth.dob")}
            </span>
            <input
              type="date"
              name="dateOfBirth"
              required
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-muted">
              {role === "parent" ? t("auth.dob_parent") : t("auth.dob_student")}
            </span>
          </label>
          {role === "parent" ? (
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("auth.relationship")}
              </span>
              <select name="relationship" className={fieldClass} defaultValue="">
                <option value="">{t("auth.add_later")}</option>
                {parentRelationships.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("auth.level")}
              </span>
              <select name="currentLevel" className={fieldClass} defaultValue="">
                <option value="">{t("auth.add_later")}</option>
                {studentLevels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {countries.length > 0 ? (
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("common.country")}
              </span>
              <select name="country" className={fieldClass} defaultValue="">
                <option value="">{t("auth.add_later")}</option>
                {countries.map((country) => (
                  <option key={country.iso2} value={country.iso2}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : null}
      <label className="mt-4 block">
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
          autoComplete="new-password"
          required
          minLength={10}
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted">
          {t("auth.password_hint")}
        </span>
      </label>
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending
          ? t("auth.creating")
          : role === "teacher"
            ? t("auth.submit_teacher")
            : role === "student"
              ? t("auth.submit_student")
              : t("auth.submit_parent")}
      </Button>
    </form>
  );
}
