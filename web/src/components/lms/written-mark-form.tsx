"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass } from "@/lib/api";
import type { QuizAnswerMark, QuizReviewItem } from "@/lib/quizzes";

export function WrittenMarkForm({
  items,
  pending,
  onSave,
}: {
  items: QuizReviewItem[];
  pending: boolean;
  onSave: (marks: QuizAnswerMark[]) => void;
}) {
  const t = useT();
  const written = items.filter((item) => item.marking === "manual");
  const [draft, setDraft] = useState<Record<string, { awarded: number; feedback: string }>>(
    () =>
      Object.fromEntries(
        written.map((item) => [
          item.questionId,
          {
            awarded: item.correct === true ? 1 : 0,
            feedback: item.feedback ?? "",
          },
        ]),
      ),
  );
  if (!written.length) return null;

  return (
    <div className="mt-6 rounded-2xl bg-background p-4">
      <p className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("marking.written")}
      </p>
      <ul className="mt-3 grid gap-4">
        {written.map((item) => {
          const current = draft[item.questionId] ?? { awarded: 0, feedback: "" };
          return (
            <li key={item.questionId} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-brand" dir="auto">
                {item.prompt}
              </p>
              <p className="mt-2 text-sm text-muted" dir="auto">
                {t("marking.answer")}: {item.given || "—"}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-brand">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`mark-${item.questionId}`}
                    checked={current.awarded === 1}
                    onChange={() =>
                      setDraft((value) => ({
                        ...value,
                        [item.questionId]: { ...current, awarded: 1 },
                      }))
                    }
                  />
                  {t("marking.award")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`mark-${item.questionId}`}
                    checked={current.awarded === 0}
                    onChange={() =>
                      setDraft((value) => ({
                        ...value,
                        [item.questionId]: { ...current, awarded: 0 },
                      }))
                    }
                  />
                  {t("marking.zero")}
                </label>
              </div>
              <textarea
                rows={2}
                value={current.feedback}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    [item.questionId]: { ...current, feedback: event.target.value },
                  }))
                }
                placeholder={t("marking.feedback")}
                className={`${fieldClass} mt-3 min-h-20 py-3`}
              />
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          onSave(
            written.map((item) => ({
              questionId: item.questionId,
              awarded: draft[item.questionId]?.awarded ?? 0,
              feedback: draft[item.questionId]?.feedback,
            })),
          )
        }
      >
        {t("marking.save")}
      </Button>
    </div>
  );
}
