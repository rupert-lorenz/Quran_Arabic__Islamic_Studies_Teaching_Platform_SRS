"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass } from "@/lib/api";
import type { QuizAnswerInput, QuizSitQuestion } from "@/lib/quizzes";

function tileClass(active: boolean) {
  return active
    ? "border-[#CB9F64] bg-[#F3E6D0] text-[#294634]"
    : "border-line bg-background text-brand";
}

export function QuizPlayer({
  questions,
  pending,
  onSubmit,
  requireAll = true,
  submitLabel,
  onAnswersChange,
}: {
  questions: QuizSitQuestion[];
  pending: boolean;
  onSubmit: (answers: QuizAnswerInput[]) => void;
  requireAll?: boolean;
  submitLabel?: string;
  onAnswersChange?: (answers: QuizAnswerInput[]) => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizAnswerInput>>({});
  const question = questions[index];
  if (!question) return null;
  const current = answers[question.id];
  const answered = questions.every((item) => {
    const answer = answers[item.id];
    if (!answer) return false;
    if (item.kind === "short" || item.kind === "written") {
      return Boolean(answer.text?.trim());
    }
    if (item.kind === "true_false") return answer.trueFalse !== undefined;
    return answer.choice !== undefined;
  });

  function setAnswer(next: QuizAnswerInput) {
    setAnswers((currentAnswers) => {
      const updated = {
        ...currentAnswers,
        [next.questionId]: next,
      };
      onAnswersChange?.(Object.values(updated));
      return updated;
    });
  }

  return (
    <div>
      <p className="text-sm font-semibold text-muted">
        {t("quiz.question_of", {
          current: index + 1,
          total: questions.length,
        })}
      </p>
      <p
        className="mt-2 font-heading text-xl font-bold tracking-tight text-brand"
        dir="auto"
      >
        {question.prompt}
      </p>

      {question.kind === "choice" ? (
        <ul className="mt-4 grid gap-2">
          {question.choices.map((choice, choiceIndex) => (
            <li key={`${choice}-${choiceIndex}`}>
              <button
                type="button"
                dir="auto"
                disabled={pending}
                onClick={() =>
                  setAnswer({
                    questionId: question.id,
                    choice: question.choiceIndexes[choiceIndex] ?? choiceIndex,
                  })
                }
                className={`w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${tileClass(
                  current?.choice ===
                    (question.choiceIndexes[choiceIndex] ?? choiceIndex),
                )}`}
              >
                {choice}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {question.kind === "true_false" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              setAnswer({ questionId: question.id, trueFalse: true })
            }
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${tileClass(current?.trueFalse === true)}`}
          >
            {t("quiz.true")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              setAnswer({ questionId: question.id, trueFalse: false })
            }
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${tileClass(current?.trueFalse === false)}`}
          >
            {t("quiz.false")}
          </button>
        </div>
      ) : null}

      {question.kind === "short" ? (
        <input
          value={current?.text ?? ""}
          dir="auto"
          disabled={pending}
          onChange={(event) =>
            setAnswer({ questionId: question.id, text: event.target.value })
          }
          placeholder={t("quiz.short_answer")}
          className={`${fieldClass} mt-4`}
        />
      ) : null}

      {question.kind === "written" ? (
        <textarea
          value={current?.text ?? ""}
          dir="auto"
          disabled={pending}
          rows={5}
          onChange={(event) =>
            setAnswer({
              questionId: question.id,
              text: event.target.value.slice(0, 2000),
            })
          }
          placeholder={t("quiz.written_answer")}
          className={`${fieldClass} mt-4 min-h-32 py-3`}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={index === 0 || pending}
          onClick={() => setIndex((currentIndex) => currentIndex - 1)}
        >
          {t("quiz.prev")}
        </Button>
        {index < questions.length - 1 ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => setIndex((currentIndex) => currentIndex + 1)}
          >
            {t("quiz.next")}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={(requireAll && !answered) || pending}
            onClick={() =>
              onSubmit(
                questions
                  .map((item) => answers[item.id])
                  .filter((item): item is QuizAnswerInput => Boolean(item)),
              )
            }
          >
            {submitLabel ?? t("quiz.submit")}
          </Button>
        )}
      </div>
    </div>
  );
}
