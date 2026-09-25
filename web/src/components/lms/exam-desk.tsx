"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { ExamDesk } from "@/server/lms/exams";

const statusKeys = {
  draft: "exam.status.draft",
  published: "exam.status.published",
  archived: "exam.status.archived",
} as const;

const windowKeys = {
  draft: "exam.window.draft",
  scheduled: "exam.window.scheduled",
  open: "exam.window.open",
  closed: "exam.window.closed",
} as const;

export function ExamDesk({ initial }: { initial: ExamDesk }) {
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
      const next = await postJson<ExamDesk>("/api/v1/exams", body);
      setDesk(next);
      setMessage(t("exam.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("exam.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
        {t("exam.title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("exam.help")}</p>

      <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
        <input
          name="title"
          required
          placeholder={t("exam.name")}
          className={`${fieldClass} md:col-span-2`}
        />
        <textarea
          name="instructions"
          rows={3}
          placeholder={t("exam.instructions")}
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
        <input
          name="durationMinutes"
          type="number"
          min={5}
          max={180}
          defaultValue={45}
          placeholder={t("exam.duration")}
          className={fieldClass}
        />
        <input
          name="passPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={50}
          placeholder={t("exam.pass_percent")}
          className={fieldClass}
        />
        <label className="text-sm font-semibold text-brand">
          {t("exam.opens")}
          <input name="opensAt" type="datetime-local" className={`${fieldClass} mt-2`} />
        </label>
        <label className="text-sm font-semibold text-brand">
          {t("exam.closes")}
          <input name="closesAt" type="datetime-local" className={`${fieldClass} mt-2`} />
        </label>
        <label className="flex items-start gap-3 text-sm font-semibold text-brand md:col-span-2">
          <input
            type="checkbox"
            name="randomiseQuestions"
            value="true"
            className="mt-1 size-4"
          />
          <span>
            {t("exam.randomise")}
            <span className="mt-1 block font-normal text-muted">
              {t("exam.randomise_help")}
            </span>
          </span>
        </label>
        <Button type="submit" disabled={pending} className="md:col-span-2">
          {t("exam.create")}
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
                {` · ${t(windowKeys[item.windowStatus])}`}
                {` · ${t("exam.minutes", { count: item.durationMinutes })}`}
                {` · ${t("exam.pass_mark", { percent: item.passPercent })}`}
                {` · ${t("exam.question_count", { count: item.questionCount })}`}
                {item.randomiseQuestions ? ` · ${t("exam.randomised")}` : ""}
                {item.opensAt
                  ? ` · ${t("exam.opens")} ${new Date(item.opensAt).toLocaleString()}`
                  : ""}
                {item.closesAt
                  ? ` · ${t("exam.closes")} ${new Date(item.closesAt).toLocaleString()}`
                  : ""}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("exam.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
