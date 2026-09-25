"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { QuizDesk } from "@/server/lms/quizzes";

const statusKeys = {
  draft: "quiz.status.draft",
  published: "quiz.status.published",
  archived: "quiz.status.archived",
} as const;

export function QuizDesk({ initial }: { initial: QuizDesk }) {
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
      const next = await postJson<QuizDesk>("/api/v1/quizzes", body);
      setDesk(next);
      setMessage(t("quiz.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("quiz.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
        {t("quiz.title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("quiz.help")}</p>

      <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
        <input
          name="title"
          required
          placeholder={t("quiz.name")}
          className={`${fieldClass} md:col-span-2`}
        />
        <textarea
          name="instructions"
          rows={3}
          placeholder={t("quiz.instructions")}
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
          name="passPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={70}
          placeholder={t("quiz.pass_percent")}
          className={fieldClass}
        />
        <input
          name="attemptLimit"
          type="number"
          min={0}
          max={10}
          defaultValue={3}
          placeholder={t("quiz.attempt_limit")}
          className={fieldClass}
        />
        <label className="flex items-start gap-3 text-sm font-semibold text-brand md:col-span-2">
          <input
            type="checkbox"
            name="randomiseQuestions"
            value="true"
            className="mt-1 size-4"
          />
          <span>
            {t("quiz.randomise")}
            <span className="mt-1 block font-normal text-muted">
              {t("quiz.randomise_help")}
            </span>
          </span>
        </label>
        <Button type="submit" disabled={pending} className="md:col-span-2">
          {t("quiz.create")}
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
                {` · ${t("quiz.question_count", { count: item.questionCount })}`}
                {item.randomiseQuestions ? ` · ${t("quiz.randomised")}` : ""}
                {item.lastAttempt
                  ? ` · ${t("quiz.score", {
                      score: item.lastAttempt.score,
                      total: item.lastAttempt.total,
                    })}`
                  : ""}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("quiz.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
