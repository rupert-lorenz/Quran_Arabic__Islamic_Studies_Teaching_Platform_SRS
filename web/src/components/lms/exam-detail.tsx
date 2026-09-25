"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postJson } from "@/lib/api";
import { EXAM_WARN_SECONDS, formatExamClock } from "@/lib/exams";
import {
  emptyQuizPayload,
  type QuizAnswerInput,
  type QuizPayload,
  type QuizQuestion,
  type QuizQuestionKind,
  type QuizReviewItem,
} from "@/lib/quizzes";
import type { QuestionBankView } from "@/server/lms/question-bank";
import type { ExamView } from "@/server/lms/exams";
import { QuizPlayer } from "./quiz-player";
import { WrittenMarkForm } from "./written-mark-form";

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

const kindKeys = {
  choice: "quiz.kind.choice",
  true_false: "quiz.kind.true_false",
  short: "quiz.kind.short",
  written: "quiz.kind.written",
} as const;

function sittingSummary(
  t: ReturnType<typeof useT>,
  passPercent: number,
  sitting: ExamView["sittings"][number],
) {
  if (!sitting.submittedAt) {
    return `${t("exam.in_progress")} · ${formatExamClock(sitting.remainingSeconds)}`;
  }
  const prefix = sitting.autoSubmitted ? `${t("exam.auto_submitted")} · ` : "";
  if (sitting.markingStatus === "pending") {
    return `${prefix}${t("marking.awaiting")} · ${new Date(sitting.submittedAt).toLocaleString()}`;
  }
  return `${prefix}${t("exam.score", {
    score: sitting.score ?? 0,
    total: sitting.total ?? 0,
  })} · ${sitting.percent ?? 0}% · ${t("exam.pass_mark", { percent: passPercent })} · ${
    sitting.passed ? t("exam.passed") : t("exam.failed_mark")
  } · ${new Date(sitting.submittedAt).toLocaleString()}`;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ExamDetail({
  initial,
  subjects,
  bank,
}: {
  initial: ExamView;
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
    initial.sitting?.review ?? null,
  );
  const answersRef = useRef<QuizAnswerInput[]>([]);

  async function run(body: Record<string, unknown>, okMessage?: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<
        ExamView & {
          result?: {
            score: number;
            total: number;
            percent: number;
            passed: boolean;
            markingStatus?: "auto" | "pending" | "marked";
            review: QuizReviewItem[] | null;
          };
        }
      >(`/api/v1/exams/${item.id}`, body);
      setItem(next);
      if (next.payload) setPayload(next.payload);
      if (next.result?.review) setReview(next.result.review);
      else if (next.sitting?.review) setReview(next.sitting.review);
      else if (!next.revealReview) setReview(null);
      setMessage(
        next.result
          ? next.result.markingStatus === "pending"
            ? t("marking.awaiting")
            : `${t("exam.score", {
                score: next.result.score,
                total: next.result.total,
              })} · ${next.result.passed ? t("exam.passed") : t("exam.failed_mark")}`
          : okMessage ?? t("exam.saved"),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("exam.failed"));
    } finally {
      setPending(false);
    }
  }

  async function refresh() {
    setPending(true);
    setError("");
    try {
      const next = await getJson<ExamView>(`/api/v1/exams/${item.id}`);
      setItem(next);
      if (next.payload) setPayload(next.payload);
      setReview(next.sitting?.review ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("exam.failed"));
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
      durationMinutes: data.durationMinutes,
      opensAt: data.opensAt,
      closesAt: data.closesAt,
      randomiseQuestions:
        data.randomiseQuestions === "true" || data.randomiseQuestions === "on",
      payload,
    });
  }

  const inProgress = Boolean(item.sitting && !item.sitting.submittedAt);
  const submitted = Boolean(item.sitting?.submittedAt);

  return (
    <div className="space-y-6">
      {item.canManage ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-muted">
            {t(statusKeys[item.status])} · {t(windowKeys[item.windowStatus])} ·{" "}
            {t("exam.minutes", { count: item.durationMinutes })} ·{" "}
            {t("exam.pass_mark", { percent: item.passPercent })} ·{" "}
            {t("exam.question_count", { count: item.questionCount })}
            {item.randomiseQuestions ? ` · ${t("exam.randomised")}` : ""}
          </p>
          <ExamRules item={item} />
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
              placeholder={t("exam.instructions")}
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
                {t("exam.pass_percent")}
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
                {t("exam.duration")}
                <input
                  name="durationMinutes"
                  type="number"
                  min={5}
                  max={180}
                  defaultValue={item.durationMinutes}
                  className={`${fieldClass} mt-2`}
                />
              </label>
              <label className="text-sm font-semibold text-brand">
                {t("exam.opens")}
                <input
                  name="opensAt"
                  type="datetime-local"
                  defaultValue={toLocalInput(item.opensAt)}
                  className={`${fieldClass} mt-2`}
                />
              </label>
              <label className="text-sm font-semibold text-brand">
                {t("exam.closes")}
                <input
                  name="closesAt"
                  type="datetime-local"
                  defaultValue={toLocalInput(item.closesAt)}
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
                  {t("exam.randomise")}
                  <span className="mt-1 block font-normal text-muted">
                    {t("exam.randomise_help")}
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
            <ExamEditor payload={payload} onChange={setPayload} />
            <Button type="submit" disabled={pending}>
              {t("exam.save")}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            {item.status !== "published" ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "published" })}
              >
                {t("exam.publish")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "draft" })}
              >
                {t("exam.unpublish")}
              </Button>
            )}
            {item.status !== "archived" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "set_status", status: "archived" })}
              >
                {t("exam.archive")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("exam.sit")}
        </h2>
        {item.instructions ? (
          <p className="mt-2 text-sm text-muted" dir="auto">
            {item.instructions}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("exam.student_help")}</p>
        )}
        <ExamRules item={item} />
        {!inProgress && !submitted ? (
          <div className="mt-4 rounded-2xl bg-background px-4 py-4">
            <p className="font-heading text-lg font-bold tracking-tight text-brand">
              {t("exam.before_start")}
            </p>
            <p className="mt-2 text-sm text-muted">{t("exam.one_sitting")}</p>
          </div>
        ) : null}
        {item.learners.length > 1 ? (
          <label className="mt-4 block text-sm font-semibold text-brand">
            {t("exam.choose_child")}
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
        {inProgress && item.sitting ? (
          <ExamTimer
            dueAt={item.sitting.dueAt}
            remainingSeconds={item.sitting.remainingSeconds}
            onExpire={() =>
              void run({
                action: "submit",
                answers: answersRef.current,
                studentUserId: studentUserId || undefined,
              })
            }
          />
        ) : null}
        {item.canStart && !inProgress && !submitted ? (
          <Button
            type="button"
            className="mt-4"
            disabled={pending}
            onClick={() =>
              void run(
                {
                  action: "start",
                  studentUserId: studentUserId || undefined,
                },
                t("exam.started"),
              )
            }
          >
            {t("exam.start")}
          </Button>
        ) : null}
        {item.sit && (item.canManage || inProgress) ? (
          <div className="mt-5">
            <QuizPlayer
              questions={item.sit}
              pending={pending}
              requireAll={false}
              submitLabel={t("exam.submit")}
              onAnswersChange={(answers) => {
                answersRef.current = answers;
              }}
              onSubmit={(answers: QuizAnswerInput[]) =>
                void run({
                  action: "submit",
                  answers,
                  studentUserId: studentUserId || undefined,
                })
              }
            />
          </div>
        ) : null}
        {!item.canManage && !item.canStart && !inProgress && !submitted ? (
          <p className="mt-4 text-sm font-semibold text-muted">
            {item.windowStatus === "scheduled"
              ? t("exam.not_open")
              : item.windowStatus === "closed"
                ? t("exam.closed")
                : t("exam.not_ready")}
          </p>
        ) : null}
        {submitted && !item.revealReview && !review?.some((row) => row.marking === "manual") ? (
          <p className="mt-4 text-sm font-semibold text-muted">
            {t("exam.hidden_answers")}
          </p>
        ) : null}
        {review?.length &&
        (item.revealReview || review.some((row) => row.marking === "manual")) ? (
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
                  {t("exam.your_answer")}: <span dir="auto">{row.given || "—"}</span>
                  {row.correct === null
                    ? ` · ${t("marking.awaiting")}`
                    : row.correct
                      ? ` · ${t("exam.correct")}`
                      : row.expected
                        ? ` · ${t("exam.expected")}: ${row.expected}`
                        : ` · ${t("exam.failed_mark")}`}
                  {row.feedback ? ` · ${row.feedback}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {item.sitting?.submittedAt && item.sitting.score !== null ? (
          <p className="mt-4 text-sm font-semibold text-brand">
            {item.sitting.autoSubmitted ? `${t("exam.auto_submitted")} · ` : ""}
            {item.sitting.markingStatus === "pending"
              ? t("marking.awaiting")
              : `${t("exam.last_score", {
                  score: item.sitting.score,
                  total: item.sitting.total ?? 0,
                  percent: item.sitting.percent ?? 0,
                })} · ${t("exam.pass_mark", { percent: item.passPercent })} · ${
                  item.sitting.passed ? t("exam.passed") : t("exam.failed_mark")
                }`}
          </p>
        ) : null}
        {item.canManage
          ? item.sittings
              .filter((sitting) => sitting.review?.some((row) => row.marking === "manual"))
              .slice(0, 8)
              .map((sitting) => (
                <div key={`${sitting.studentUserId}-${sitting.startedAt}`} className="mt-4">
                  <p className="text-sm font-semibold text-muted">
                    {sitting.studentName}
                  </p>
                  <WrittenMarkForm
                    items={sitting.review ?? []}
                    pending={pending}
                    onSave={(marks) =>
                      void run({
                        action: "mark",
                        studentUserId: sitting.studentUserId,
                        marks,
                      })
                    }
                  />
                </div>
              ))
          : null}
        {item.canManage ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={pending}
            onClick={() => void refresh()}
          >
            {t("exam.refresh")}
          </Button>
        ) : null}
      </section>

      {item.canManage && item.sittings.length ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("exam.sittings")}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm font-semibold text-muted">
            {item.sittings.map((sitting) => (
              <li key={`${sitting.studentUserId}-${sitting.startedAt}`}>
                {sitting.studentName} · {sittingSummary(t, item.passPercent, sitting)}
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

function ExamTimer({
  dueAt,
  remainingSeconds,
  onExpire,
}: {
  dueAt: string;
  remainingSeconds: number;
  onExpire: () => void;
}) {
  const t = useT();
  const [left, setLeft] = useState(remainingSeconds);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expired.current = false;
    const due = new Date(dueAt).getTime();
    const tick = () => {
      const next = Math.max(0, Math.floor((due - Date.now()) / 1000));
      setLeft(next);
      if (next <= 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [dueAt]);

  const warning = left > 0 && left <= EXAM_WARN_SECONDS;
  return (
    <div className="mt-4">
      <p
        className={`font-heading text-3xl font-bold tracking-tight ${
          warning ? "text-[#CB9F64]" : "text-brand"
        }`}
      >
        {t("exam.time_left", { clock: formatExamClock(left) })}
      </p>
      {warning ? (
        <p className="mt-1 text-sm font-semibold text-[#CB9F64]">
          {t("exam.time_warning")}
        </p>
      ) : null}
    </div>
  );
}

function ExamRules({ item }: { item: ExamView }) {
  const t = useT();
  return (
    <dl className="mt-4 grid gap-3 rounded-2xl bg-background px-4 py-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-muted">{t(windowKeys[item.windowStatus])}</dt>
        <dd className="mt-1 font-semibold text-brand">
          {item.opensAt || item.closesAt
            ? t("exam.window_summary", {
                opens: item.opensAt ? new Date(item.opensAt).toLocaleString() : "—",
                closes: item.closesAt ? new Date(item.closesAt).toLocaleString() : "—",
              })
            : t("exam.window.draft")}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-muted">{t("exam.duration")}</dt>
        <dd className="mt-1 font-semibold text-brand">
          {t("exam.minutes", { count: item.durationMinutes })}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-muted">{t("exam.pass_percent")}</dt>
        <dd className="mt-1 font-semibold text-brand">
          {t("exam.pass_mark", { percent: item.passPercent })}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-muted">{t("exam.question_count", { count: item.questionCount })}</dt>
        <dd className="mt-1 font-semibold text-brand">
          {t("exam.one_sitting")}
          {item.randomiseQuestions ? ` · ${t("exam.randomised")}` : ""}
        </dd>
      </div>
    </dl>
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
        {bank.map((row) => (
          <li key={row.id}>
            <label className="flex items-start gap-2 text-sm font-semibold text-brand">
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, row.id]
                      : current.filter((id) => id !== row.id),
                  )
                }
              />
              <span dir="auto">
                {row.prompt}
                {row.topic ? ` · ${row.topic}` : ""}
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
        {t("exam.add_from_bank")}
      </Button>
    </div>
  );
}

function ExamEditor({
  payload,
  onChange,
}: {
  payload: QuizPayload;
  onChange: (payload: QuizPayload) => void;
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
              {question.accepted.map((accepted, acceptedIndex) => (
                <input
                  key={acceptedIndex}
                  value={accepted}
                  dir="auto"
                  onChange={(event) => {
                    const next = [...question.accepted];
                    next[acceptedIndex] = event.target.value;
                    update(index, { ...question, accepted: next });
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
