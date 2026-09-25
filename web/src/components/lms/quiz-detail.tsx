"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postJson } from "@/lib/api";
import {
  emptyQuizPayload,
  type QuizAnswerInput,
  type QuizPayload,
  type QuizQuestion,
  type QuizQuestionKind,
  type QuizReviewItem,
} from "@/lib/quizzes";
import type { QuestionBankView } from "@/server/lms/question-bank";
import type { QuizView } from "@/server/lms/quizzes";
import { QuizPlayer } from "./quiz-player";
import { WrittenMarkForm } from "./written-mark-form";

const statusKeys = {
  draft: "quiz.status.draft",
  published: "quiz.status.published",
  archived: "quiz.status.archived",
} as const;

const kindKeys = {
  choice: "quiz.kind.choice",
  true_false: "quiz.kind.true_false",
  short: "quiz.kind.short",
  written: "quiz.kind.written",
} as const;

export function QuizDetail({
  initial,
  subjects,
  bank,
}: {
  initial: QuizView;
  subjects: Array<{ slug: string; name: string }>;
  bank?: QuestionBankView[];
}) {
  const t = useT();
  const [item, setItem] = useState(initial);
  const [payload, setPayload] = useState<QuizPayload>(
    initial.payload ?? emptyQuizPayload(),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [studentUserId, setStudentUserId] = useState(
    initial.learners[0]?.studentUserId ?? "",
  );
  const [review, setReview] = useState<QuizReviewItem[] | null>(
    initial.lastAttempt?.review ?? null,
  );

  async function run(body: Record<string, unknown>, okMessage?: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<
        QuizView & {
          result?: {
            score: number;
            total: number;
            percent: number;
            passed: boolean;
            markingStatus?: "auto" | "pending" | "marked";
            review: QuizReviewItem[];
          };
        }
      >(`/api/v1/quizzes/${item.id}`, body);
      setItem(next);
      if (next.payload) setPayload(next.payload);
      if (next.result?.review) setReview(next.result.review);
      else if (next.lastAttempt?.review) setReview(next.lastAttempt.review);
      setMessage(
        next.result
          ? next.result.markingStatus === "pending"
            ? t("marking.awaiting")
            : `${t("quiz.score", {
                score: next.result.score,
                total: next.result.total,
              })} · ${next.result.passed ? t("quiz.passed") : t("quiz.failed_mark")}`
          : okMessage ?? t("quiz.saved"),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("quiz.failed"));
    } finally {
      setPending(false);
    }
  }

  async function refresh() {
    setPending(true);
    setError("");
    try {
      const next = await getJson<QuizView>(`/api/v1/quizzes/${item.id}`);
      setItem(next);
      if (next.payload) setPayload(next.payload);
      setReview(next.lastAttempt?.review ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("quiz.failed"));
    } finally {
      setPending(false);
    }
  }

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void run({
      action: "save",
      title: data.title,
      instructions: data.instructions,
      subjectSlug: data.subjectSlug,
      passPercent: data.passPercent,
      attemptLimit: data.attemptLimit,
      randomiseQuestions:
        data.randomiseQuestions === "true" || data.randomiseQuestions === "on",
      payload,
    });
  }

  return (
    <div className="space-y-6">
      {item.canManage ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-muted">
            {t(statusKeys[item.status])} ·{" "}
            {t("quiz.question_count", { count: item.questionCount })}
            {item.randomiseQuestions ? ` · ${t("quiz.randomised")}` : ""}
          </p>
          <form className="mt-4 grid gap-3" onSubmit={onSave}>
            <input
              name="title"
              required
              defaultValue={item.title}
              className={fieldClass}
            />
            <textarea
              name="instructions"
              rows={3}
              defaultValue={item.instructions ?? ""}
              placeholder={t("quiz.instructions")}
              className={`${fieldClass} min-h-24 py-3`}
            />
            <select
              name="subjectSlug"
              className={fieldClass}
              defaultValue={item.subjectSlug ?? ""}
            >
              <option value="">{t("library.any_subject")}</option>
              {subjects.map((subject) => (
                <option key={subject.slug} value={subject.slug}>
                  {subject.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-brand">
                {t("quiz.pass_percent")}
                <input
                  name="passPercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={item.passPercent}
                  className={`${fieldClass} mt-2`}
                />
              </label>
              <label className="text-sm font-semibold text-brand">
                {t("quiz.attempt_limit")}
                <input
                  name="attemptLimit"
                  type="number"
                  min={0}
                  max={10}
                  defaultValue={item.attemptLimit}
                  className={`${fieldClass} mt-2`}
                />
              </label>
              <label className="flex items-start gap-3 text-sm font-semibold text-brand md:col-span-2">
                <input
                  type="checkbox"
                  name="randomiseQuestions"
                  value="true"
                  defaultChecked={item.randomiseQuestions}
                  className="mt-1 size-4"
                />
                <span>
                  {t("quiz.randomise")}
                  <span className="mt-1 block font-normal text-muted">
                    {t("quiz.randomise_help")}
                  </span>
                </span>
              </label>
            </div>
            {bank?.length ? (
              <BankImport
                bank={bank}
                pending={pending}
                onImport={(questionIds) =>
                  void run({ action: "import_bank", questionIds })
                }
              />
            ) : null}
            <QuizEditor
              payload={payload}
              onChange={setPayload}
              onSaveToBank={
                item.canManage
                  ? (questionId) =>
                      void run({ action: "save_to_bank", questionId })
                  : undefined
              }
            />
            <Button type="submit" disabled={pending}>
              {t("quiz.save")}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            {item.status !== "published" ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "published" })}
              >
                {t("quiz.publish")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "draft" })}
              >
                {t("quiz.unpublish")}
              </Button>
            )}
            {item.status !== "archived" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "archived" })}
              >
                {t("quiz.archive")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("quiz.sit")}
        </h2>
        {item.instructions ? (
          <p className="mt-2 text-sm text-muted" dir="auto">
            {item.instructions}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("quiz.student_help")}</p>
        )}
        <p className="mt-2 text-sm font-semibold text-muted">
          {t("quiz.pass_mark", { percent: item.passPercent })}
          {item.attemptLimit > 0
            ? ` · ${t("quiz.attempts_left", {
                count: item.remainingAttempts ?? 0,
              })}`
            : ` · ${t("quiz.unlimited")}`}
          {item.randomiseQuestions ? ` · ${t("quiz.randomised")}` : ""}
        </p>
        {item.learners.length > 1 ? (
          <label className="mt-4 block text-sm font-semibold text-brand">
            {t("quiz.choose_child")}
            <select
              className={`${fieldClass} mt-2`}
              value={studentUserId}
              onChange={(event) => setStudentUserId(event.target.value)}
            >
              {item.learners.map((learner) => (
                <option key={learner.studentUserId} value={learner.studentUserId}>
                  {learner.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {item.sit ? (
          <div className="mt-5">
            <QuizPlayer
              questions={item.sit}
              pending={pending}
              onSubmit={(answers: QuizAnswerInput[]) =>
                void run({
                  action: "sit",
                  answers,
                  studentUserId: studentUserId || undefined,
                })
              }
            />
          </div>
        ) : item.lastAttempt ? (
          <p className="mt-4 text-sm font-semibold text-brand">
            {t("quiz.no_attempts")}
          </p>
        ) : (
          <p className="mt-4 text-sm font-semibold text-muted">{t("quiz.not_ready")}</p>
        )}
        {review?.length ? (
          <ul className="mt-6 grid gap-2">
            {review.map((row, index) => (
              <li
                key={row.questionId}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  row.correct
                    ? "border-[#294634] bg-[#294634] text-white"
                    : "border-[#CB9F64] bg-[#F3E6D0] text-[#294634]"
                }`}
              >
                <p className="font-semibold" dir="auto">
                  {index + 1}. {row.prompt}
                </p>
                <p className="mt-1">
                  {t("quiz.your_answer")}: <span dir="auto">{row.given || "—"}</span>
                  {row.correct === null
                    ? ` · ${t("marking.awaiting")}`
                    : row.correct
                      ? ` · ${t("quiz.correct")}`
                      : row.expected
                        ? ` · ${t("quiz.expected")}: ${row.expected}`
                        : ` · ${t("quiz.failed_mark")}`}
                  {row.feedback ? ` · ${row.feedback}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {item.lastAttempt ? (
          <p className="mt-4 text-sm font-semibold text-brand">
            {item.lastAttempt.markingStatus === "pending"
              ? t("marking.awaiting")
              : `${t("quiz.last_score", {
                  score: item.lastAttempt.score,
                  total: item.lastAttempt.total,
                  percent: item.lastAttempt.percent,
                })} · ${item.lastAttempt.passed ? t("quiz.passed") : t("quiz.failed_mark")}`}
          </p>
        ) : null}
        {item.canManage
          ? item.attempts
              .filter((attempt) => attempt.review?.some((row) => row.marking === "manual"))
              .slice(0, 8)
              .map((attempt) => (
                <div key={attempt.id} className="mt-4">
                  <p className="text-sm font-semibold text-muted">
                    {attempt.studentName}
                  </p>
                  <WrittenMarkForm
                    items={attempt.review ?? []}
                    pending={pending}
                    onSave={(marks) =>
                      void run({
                        action: "mark",
                        attemptId: attempt.id,
                        marks,
                      })
                    }
                  />
                </div>
              ))
          : null}
        {item.canSit ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={pending}
            onClick={() => void refresh()}
          >
            {t("quiz.again")}
          </Button>
        ) : null}
      </section>

      {item.canManage && item.attempts.length ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("quiz.attempts")}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm font-semibold text-muted">
            {item.attempts.map((attempt) => (
              <li key={attempt.id}>
                {attempt.studentName} ·{" "}
                {attempt.markingStatus === "pending"
                  ? t("marking.awaiting")
                  : `${t("quiz.score", { score: attempt.score, total: attempt.total })} · ${attempt.percent}% · ${
                      attempt.passed ? t("quiz.passed") : t("quiz.failed_mark")
                    }`}{" "}
                · {new Date(attempt.submittedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p className="text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
    </div>
  );
}

function emptyQuestion(kind: QuizQuestionKind, index: number): QuizQuestion {
  if (kind === "true_false") {
    return { id: `q-${index + 1}-${Date.now()}`, kind, prompt: "", answer: true };
  }
  if (kind === "short") {
    return {
      id: `q-${index + 1}-${Date.now()}`,
      kind,
      prompt: "",
      accepted: [""],
    };
  }
  if (kind === "written") {
    return { id: `q-${index + 1}-${Date.now()}`, kind, prompt: "" };
  }
  return {
    id: `q-${index + 1}-${Date.now()}`,
    kind: "choice",
    prompt: "",
    choices: ["", ""],
    answer: 0,
  };
}

function BankImport({
  bank,
  pending,
  onImport,
}: {
  bank: QuestionBankView[];
  pending: boolean;
  onImport: (questionIds: string[]) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="text-sm font-semibold text-brand">{t("bank.import")}</p>
      <ul className="mt-3 grid max-h-56 gap-2 overflow-auto">
        {bank.map((item) => (
          <li key={item.id}>
            <label className="flex items-start gap-2 text-sm font-semibold text-brand">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
              <span dir="auto">
                {item.prompt}
                {item.topic ? ` · ${item.topic}` : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={!selected.length || pending}
        onClick={() => onImport(selected)}
      >
        {t("bank.add_to_quiz")}
      </Button>
    </div>
  );
}

function QuizEditor({
  payload,
  onChange,
  onSaveToBank,
}: {
  payload: QuizPayload;
  onChange: (payload: QuizPayload) => void;
  onSaveToBank?: (questionId: string) => void;
}) {
  const t = useT();

  function update(index: number, next: QuizQuestion) {
    onChange({
      questions: payload.questions.map((question, questionIndex) =>
        questionIndex === index ? next : question,
      ),
    });
  }

  return (
    <div className="grid gap-4">
      {payload.questions.map((question, index) => (
        <div key={question.id} className="rounded-2xl bg-background p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              className={fieldClass}
              value={question.kind}
              onChange={(event) =>
                update(
                  index,
                  emptyQuestion(event.target.value as QuizQuestionKind, index),
                )
              }
            >
              {(["choice", "true_false", "short", "written"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(kindKeys[kind])}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {onSaveToBank ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSaveToBank(question.id)}
                >
                  {t("bank.save_question")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onChange({
                    questions: payload.questions.filter(
                      (_, questionIndex) => questionIndex !== index,
                    ),
                  })
                }
              >
                {t("quiz.remove")}
              </Button>
            </div>
          </div>
          <input
            value={question.prompt}
            dir="auto"
            onChange={(event) =>
              update(index, { ...question, prompt: event.target.value })
            }
            placeholder={t("quiz.question")}
            className={`${fieldClass} mt-3`}
          />
          {question.kind === "choice" ? (
            <ul className="mt-3 grid gap-2">
              {question.choices.map((choice, choiceIndex) => (
                <li key={choiceIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    checked={question.answer === choiceIndex}
                    onChange={() =>
                      update(index, { ...question, answer: choiceIndex })
                    }
                  />
                  <input
                    value={choice}
                    dir="auto"
                    onChange={(event) => {
                      const choices = [...question.choices];
                      choices[choiceIndex] = event.target.value;
                      update(index, { ...question, choices });
                    }}
                    placeholder={t("quiz.choice")}
                    className={fieldClass}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {question.kind === "choice" ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() =>
                update(index, {
                  ...question,
                  choices: [...question.choices, ""],
                })
              }
            >
              {t("quiz.add_choice")}
            </Button>
          ) : null}
          {question.kind === "true_false" ? (
            <div className="mt-3 flex gap-4 text-sm font-semibold text-brand">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${question.id}`}
                  checked={question.answer}
                  onChange={() => update(index, { ...question, answer: true })}
                />
                {t("quiz.true")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${question.id}`}
                  checked={!question.answer}
                  onChange={() => update(index, { ...question, answer: false })}
                />
                {t("quiz.false")}
              </label>
            </div>
          ) : null}
          {question.kind === "written" ? (
            <p className="mt-3 text-sm font-semibold text-muted">
              {t("marking.written_help")}
            </p>
          ) : null}
          {question.kind === "short" ? (
            <div className="mt-3 grid gap-2">
              {question.accepted.map((item, acceptedIndex) => (
                <input
                  key={acceptedIndex}
                  value={item}
                  dir="auto"
                  onChange={(event) => {
                    const accepted = [...question.accepted];
                    accepted[acceptedIndex] = event.target.value;
                    update(index, { ...question, accepted });
                  }}
                  placeholder={t("quiz.accepted")}
                  className={fieldClass}
                />
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  update(index, {
                    ...question,
                    accepted: [...question.accepted, ""],
                  })
                }
              >
                {t("quiz.add_accepted")}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange({
            questions: [
              ...payload.questions,
              emptyQuestion("choice", payload.questions.length),
            ],
          })
        }
      >
        {t("quiz.add_question")}
      </Button>
    </div>
  );
}
