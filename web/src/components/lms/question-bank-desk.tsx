"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import { QUIZ_QUESTION_KINDS } from "@/lib/quizzes";
import type { QuestionBankDesk } from "@/server/lms/question-bank";

const statusKeys = {
  draft: "bank.status.draft",
  published: "bank.status.published",
  archived: "bank.status.archived",
} as const;

const kindKeys = {
  choice: "quiz.kind.choice",
  true_false: "quiz.kind.true_false",
  short: "quiz.kind.short",
  written: "quiz.kind.written",
} as const;

export function QuestionBankDesk({ initial }: { initial: QuestionBankDesk }) {
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
      const next = await postJson<QuestionBankDesk>("/api/v1/questions", body);
      setDesk(next);
      setMessage(t("bank.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bank.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
        {t("bank.title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("bank.help")}</p>

      <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
        <textarea
          name="prompt"
          required
          rows={3}
          placeholder={t("bank.prompt")}
          className={`${fieldClass} min-h-24 py-3 md:col-span-2`}
        />
        <select name="kind" className={fieldClass} defaultValue="choice">
          {QUIZ_QUESTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(kindKeys[kind])}
            </option>
          ))}
        </select>
        <input name="topic" placeholder={t("bank.topic")} className={fieldClass} />
        <select name="subjectSlug" className={fieldClass} defaultValue="">
          <option value="">{t("library.any_subject")}</option>
          {desk.subjects.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {t("bank.create")}
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
                <span dir="auto">{item.prompt}</span>
                {` · ${t(kindKeys[item.kind])}`}
                {` · ${t(statusKeys[item.status])}`}
                {item.topic ? ` · ${item.topic}` : ""}
                {item.subjectName ? ` · ${item.subjectName}` : ""}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("bank.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
