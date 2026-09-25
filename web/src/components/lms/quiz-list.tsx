"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { QuizView } from "@/server/lms/quizzes";

export function QuizList({ items }: { items: QuizView[] }) {
  const t = useT();
  if (!items.length) {
    return <p className="text-sm font-semibold text-muted">{t("quiz.none")}</p>;
  }

  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.href}
            className="block rounded-[2rem] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
          >
            <p className="font-heading text-lg font-bold tracking-tight text-brand">
              {item.title}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {t("quiz.question_count", { count: item.questionCount })}
              {item.randomiseQuestions ? ` · ${t("quiz.randomised")}` : ""}
              {item.subjectName ? ` · ${item.subjectName}` : ""}
              {item.lastAttempt
                ? item.lastAttempt.markingStatus === "pending"
                  ? ` · ${t("marking.awaiting")}`
                  : ` · ${t("quiz.score", {
                      score: item.lastAttempt.score,
                      total: item.lastAttempt.total,
                    })} · ${item.lastAttempt.passed ? t("quiz.passed") : t("quiz.failed_mark")}`
                : ` · ${t("quiz.sit")}`}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
