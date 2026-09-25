"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import { emptyBankQuestion } from "@/lib/question-bank";
import {
  QUIZ_QUESTION_KINDS,
  type QuizQuestion,
  type QuizQuestionKind,
} from "@/lib/quizzes";
import type { QuestionBankView } from "@/server/lms/question-bank";

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

export function QuestionBankDetail({
  initial,
  subjects,
}: {
  initial: QuestionBankView;
  subjects: Array<{ slug: string; name: string }>;
}) {
  const t = useT();
  const [item, setItem] = useState(initial);
  const [question, setQuestion] = useState<QuizQuestion>(initial.question);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function run(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<QuestionBankView>(
        `/api/v1/questions/${item.id}`,
        body,
      );
      setItem(next);
      setQuestion(next.question);
      setMessage(t("bank.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bank.failed"));
    } finally {
      setPending(false);
    }
  }

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void run({
      prompt: question.prompt,
      kind: question.kind,
      topic: data.topic,
      subjectSlug: data.subjectSlug,
      question,
    });
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-muted">
        {t(kindKeys[item.kind])} · {t(statusKeys[item.status])}
      </p>
      <form className="mt-4 grid gap-3" onSubmit={onSave}>
        <select
          className={fieldClass}
          value={question.kind}
          disabled={!item.canManage}
          onChange={(event) =>
            setQuestion(
              emptyBankQuestion(event.target.value as QuizQuestionKind),
            )
          }
        >
          {QUIZ_QUESTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(kindKeys[kind])}
            </option>
          ))}
        </select>
        <textarea
          dir="auto"
          rows={3}
          value={question.prompt}
          disabled={!item.canManage}
          onChange={(event) =>
            setQuestion({ ...question, prompt: event.target.value })
          }
          placeholder={t("bank.prompt")}
          className={`${fieldClass} min-h-24 py-3`}
        />
        <input
          name="topic"
          defaultValue={item.topic ?? ""}
          disabled={!item.canManage}
          placeholder={t("bank.topic")}
          className={fieldClass}
        />
        <select
          name="subjectSlug"
          className={fieldClass}
          defaultValue={item.subjectSlug ?? ""}
          disabled={!item.canManage}
        >
          <option value="">{t("library.any_subject")}</option>
          {subjects.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
        <BankAnswers question={question} disabled={!item.canManage} onChange={setQuestion} />
        {item.canManage ? (
          <Button type="submit" disabled={pending}>
            {t("bank.save")}
          </Button>
        ) : null}
      </form>
      {item.canManage ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {item.status !== "published" ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                void run({
                  status: "published",
                  prompt: question.prompt,
                  kind: question.kind,
                  question,
                })
              }
            >
              {t("bank.publish")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void run({ status: "draft" })}
            >
              {t("bank.unpublish")}
            </Button>
          )}
          {item.status !== "archived" ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void run({ status: "archived" })}
            >
              {t("bank.archive")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}

function BankAnswers({
  question,
  disabled,
  onChange,
}: {
  question: QuizQuestion;
  disabled: boolean;
  onChange: (question: QuizQuestion) => void;
}) {
  const t = useT();
  if (question.kind === "choice") {
    return (
      <div className="grid gap-2">
        {question.choices.map((choice, index) => (
          <label key={index} className="flex items-center gap-2">
            <input
              type="radio"
              name={`bank-${question.id}`}
              checked={question.answer === index}
              disabled={disabled}
              onChange={() => onChange({ ...question, answer: index })}
            />
            <input
              value={choice}
              dir="auto"
              disabled={disabled}
              onChange={(event) => {
                const choices = [...question.choices];
                choices[index] = event.target.value;
                onChange({ ...question, choices });
              }}
              placeholder={t("quiz.choice")}
              className={fieldClass}
            />
          </label>
        ))}
        {disabled ? null : (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({ ...question, choices: [...question.choices, ""] })
            }
          >
            {t("quiz.add_choice")}
          </Button>
        )}
      </div>
    );
  }
  if (question.kind === "written") {
    return (
      <p className="text-sm font-semibold text-muted">{t("marking.written_help")}</p>
    );
  }
  if (question.kind === "true_false") {
    return (
      <div className="flex gap-4 text-sm font-semibold text-brand">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`tf-${question.id}`}
            checked={question.answer}
            disabled={disabled}
            onChange={() => onChange({ ...question, answer: true })}
          />
          {t("quiz.true")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`tf-${question.id}`}
            checked={!question.answer}
            disabled={disabled}
            onChange={() => onChange({ ...question, answer: false })}
          />
          {t("quiz.false")}
        </label>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {question.accepted.map((item, index) => (
        <input
          key={index}
          value={item}
          dir="auto"
          disabled={disabled}
          onChange={(event) => {
            const accepted = [...question.accepted];
            accepted[index] = event.target.value;
            onChange({ ...question, accepted });
          }}
          placeholder={t("quiz.accepted")}
          className={fieldClass}
        />
      ))}
      {disabled ? null : (
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({ ...question, accepted: [...question.accepted, ""] })
          }
        >
          {t("quiz.add_accepted")}
        </Button>
      )}
    </div>
  );
}
