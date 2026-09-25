"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { ExamView } from "@/server/lms/exams";

const windowKeys = {
  draft: "exam.window.draft",
  scheduled: "exam.window.scheduled",
  open: "exam.window.open",
  closed: "exam.window.closed",
} as const;

export function ExamList({ items }: { items: ExamView[] }) {
  const t = useT();
  if (!items.length) {
    return <p className="text-sm font-semibold text-muted">{t("exam.none")}</p>;
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
              {t(windowKeys[item.windowStatus])}
              {` · ${t("exam.minutes", { count: item.durationMinutes })}`}
              {` · ${t("exam.pass_mark", { percent: item.passPercent })}`}
              {item.randomiseQuestions ? ` · ${t("exam.randomised")}` : ""}
              {item.subjectName ? ` · ${item.subjectName}` : ""}
              {item.sitting?.submittedAt && item.sitting.markingStatus === "pending"
                ? ` · ${t("marking.awaiting")}`
                : item.sitting?.submittedAt &&
                    item.sitting.score !== null &&
                    item.sitting.markingStatus !== "pending"
                  ? ` · ${t("exam.score", {
                      score: item.sitting.score,
                      total: item.sitting.total ?? 0,
                    })} · ${item.sitting.passed ? t("exam.passed") : t("exam.failed_mark")}`
                  : item.canStart
                    ? ` · ${t("exam.start")}`
                    : ""}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
