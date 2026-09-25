"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { HomeworkView } from "@/server/lms/homework";

const workKeys = {
  assigned: "homework.work.assigned",
  submitted: "homework.work.submitted",
  marked: "homework.work.marked",
} as const;

export function HomeworkLearnerList({ items }: { items: HomeworkView[] }) {
  const t = useT();
  if (!items.length) {
    return <p className="text-sm font-semibold text-muted">{t("homework.none")}</p>;
  }

  return (
    <ul className="grid gap-3">
      {items.map((item) => {
        const work = item.work[0];
        return (
          <li key={item.id}>
            <a
              href={item.href}
              className="block rounded-[2rem] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
            >
              <p className="font-heading text-lg font-bold tracking-tight text-brand">
                {item.title}
              </p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {item.teacherName}
                {item.subjectName ? ` · ${item.subjectName}` : ""}
                {work ? ` · ${t(workKeys[work.status])}` : ""}
                {work?.isLate ? ` · ${t("homework.late")}` : ""}
                {item.dueAt
                  ? ` · ${t("homework.due")} ${new Date(item.dueAt).toLocaleString()}`
                  : ""}
              </p>
              {item.work.length > 1 ? (
                <p className="mt-2 text-sm text-muted">
                  {item.work
                    .map((row) => `${row.studentName} · ${t(workKeys[row.status])}`)
                    .join(" · ")}
                </p>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
