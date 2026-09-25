"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, putJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type LocaleRow = {
  code: string;
  name: string;
  direction: "ltr" | "rtl";
  isEnabled: boolean;
  isDefault: boolean;
};

type Workspace = {
  defaultLocale: string;
  canManageLocales: boolean;
  canEditTranslations: boolean;
  summary: {
    locales: number;
    enabled: number;
    translations: number;
  };
  locales: LocaleRow[];
  uiMessages: {
    key: string;
    defaultValue: string;
    values: Record<string, string>;
  }[];
  subjects: {
    slug: string;
    name: string;
    values: Record<string, { name: string; description: string }>;
  }[];
};

export function StaffLanguages({ initial }: { initial: Workspace }) {
  const [data, setData] = useState(initial);
  const [locale, setLocale] = useState(
    initial.locales.find((item) => item.code === "ar")?.code ??
      initial.locales[0]?.code ??
      "en",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const current = useMemo(
    () => data.locales.find((item) => item.code === locale),
    [data.locales, locale],
  );

  async function save<T>(task: () => Promise<T>, ok: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      setData((await task()) as Workspace);
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StaffStat label="Languages" value={data.summary.locales} />
        <StaffStat label="Available" value={data.summary.enabled} />
        <StaffStat label="Translations" value={data.summary.translations} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        English interface copy lives in code. Other languages override it here.
        Subject names already use the translations table. Hidden languages stay
        on existing accounts but cannot be chosen.
      </p>
      <StaffFlash error={error} message={message} />

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Locales</h2>
        <div className="mt-4 grid gap-3">
          {data.locales.map((item) => (
            <div
              key={item.code}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
            >
              <div>
                <p className="font-extrabold text-brand">
                  {item.name}{" "}
                  <span className="text-sm font-bold text-muted">
                    {item.code.toUpperCase()} · {item.direction.toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {item.isDefault ? "Platform default" : "Optional language"}
                </p>
              </div>
              {data.canManageLocales ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || item.isDefault}
                  onClick={() =>
                    save(
                      () =>
                        patchJson<Workspace>(
                          `/api/v1/staff/locales/${item.code}`,
                          { isEnabled: !item.isEnabled },
                        ),
                      item.isEnabled ? "Language hidden." : "Language enabled.",
                    )
                  }
                >
                  {item.isEnabled ? "Hide" : "Enable"}
                </Button>
              ) : (
                <p className="text-sm font-bold text-muted">
                  {item.isEnabled ? "Available" : "Hidden"}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <label className="mt-8 block max-w-xs">
        <span className="mb-1 block text-sm font-bold text-brand">
          Editing language
        </span>
        <select
          className={fieldClass}
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
        >
          {data.locales.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <section className="mt-6 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Interface copy</h2>
        <p className="mt-2 text-sm text-muted">
          Public chrome in this pass: navigation, footer, subjects, and the
          language label.
        </p>
        <div className="mt-4 grid gap-4">
          {data.uiMessages.map((item) => (
            <form
              key={`${item.key}-${locale}`}
              className="grid gap-3 rounded-2xl border border-line p-4 md:grid-cols-[14rem_1fr_auto] md:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                if (!data.canEditTranslations) return;
                const form = new FormData(event.currentTarget);
                void save(
                  () =>
                    putJson<Workspace>("/api/v1/staff/translations", {
                      entityType: "ui",
                      entityKey: item.key,
                      locale,
                      field: "text",
                      value: String(form.get("value") ?? ""),
                    }),
                  "Interface copy saved.",
                );
              }}
            >
              <div>
                <p className="text-xs font-bold tracking-wide text-brand-soft uppercase">
                  {item.key}
                </p>
                <p className="mt-1 text-sm text-muted">{item.defaultValue}</p>
              </div>
              <input
                name="value"
                required
                defaultValue={item.values[locale] || item.defaultValue}
                className={fieldClass}
                dir={current?.direction ?? "auto"}
              />
              {data.canEditTranslations ? (
                <Button type="submit" disabled={pending}>
                  Save
                </Button>
              ) : null}
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Subjects</h2>
        <div className="mt-4 grid gap-4">
          {data.subjects.map((subject) => (
            <form
              key={`${subject.slug}-${locale}`}
              className="rounded-2xl border border-line p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!data.canEditTranslations) return;
                const form = new FormData(event.currentTarget);
                const name = String(form.get("name") ?? "");
                const description = String(form.get("description") ?? "");
                void save(async () => {
                  await putJson<Workspace>("/api/v1/staff/translations", {
                    entityType: "subject",
                    entityKey: subject.slug,
                    locale,
                    field: "name",
                    value: name,
                  });
                  return putJson<Workspace>("/api/v1/staff/translations", {
                    entityType: "subject",
                    entityKey: subject.slug,
                    locale,
                    field: "description",
                    value: description,
                  });
                }, "Subject translation saved.");
              }}
            >
              <p className="font-extrabold text-brand">{subject.name}</p>
              <p className="text-sm text-muted">{subject.slug}</p>
              <div className="mt-3 grid gap-3">
                <input
                  name="name"
                  required
                  defaultValue={
                    subject.values[locale]?.name || subject.values.en?.name
                  }
                  className={fieldClass}
                  dir={current?.direction ?? "auto"}
                />
                <textarea
                  name="description"
                  required
                  rows={2}
                  defaultValue={
                    subject.values[locale]?.description ||
                    subject.values.en?.description
                  }
                  className={fieldClass}
                  dir={current?.direction ?? "auto"}
                />
              </div>
              {data.canEditTranslations ? (
                <div className="mt-3">
                  <Button type="submit" disabled={pending}>
                    Save subject
                  </Button>
                </div>
              ) : null}
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
