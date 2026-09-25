"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { HomeworkDesk } from "@/server/lms/homework";

const statusKeys = {
  draft: "homework.status.draft",
  assigned: "homework.status.assigned",
  closed: "homework.status.closed",
} as const;

export function HomeworkDesk({ initial }: { initial: HomeworkDesk }) {
  const t = useT();
  const [desk, setDesk] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<HomeworkDesk>("/api/v1/homework", body);
      setDesk(next);
      setMessage(t("homework.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("homework.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
        {t("homework.title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("homework.help")}</p>

      <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
        <input
          name="title"
          required
          placeholder={t("homework.name")}
          className={`${fieldClass} md:col-span-2`}
        />
        <textarea
          name="instructions"
          rows={3}
          placeholder={t("homework.instructions")}
          className={`${fieldClass} min-h-24 py-3 md:col-span-2`}
        />
        <select name="subjectSlug" className={fieldClass} defaultValue="">
          <option value="">{t("library.any_subject")}</option>
          {desk.subjects.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
        <input name="dueAt" type="datetime-local" className={fieldClass} />
        <Button type="submit" disabled={pending} className="md:col-span-2">
          {t("homework.create")}
        </Button>
      </form>

      {desk.items.length ? (
        <ul className="mt-6 grid gap-3">
          {desk.items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className="block rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-brand"
              >
                {item.title}
                {` · ${t(statusKeys[item.status])}`}
                {` · ${t("homework.assigned_count", { count: item.assignedCount })}`}
                {` · ${t("homework.marked_count", { count: item.markedCount })}`}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("homework.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
