"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { StudentReportDesk, StudentReportRow } from "@/server/lms/reports";

const kindKeys = {
  quiz: "report.kind.quiz",
  exam: "report.kind.exam",
  homework: "report.kind.homework",
  game: "report.kind.game",
  course: "report.kind.course",
  lesson: "report.kind.lesson",
} as const;

const statusKeys: Record<string, UiMessageKey> = {
  passed: "report.status.passed",
  failed: "report.status.failed",
  pending: "report.status.pending",
  marked: "report.status.marked",
  submitted: "report.status.submitted",
  assigned: "report.status.assigned",
  in_progress: "report.status.in_progress",
  completed: "report.status.completed",
  started: "report.status.started",
  cancelled: "report.status.cancelled",
  no_show: "report.status.no_show",
};

function statusLabel(t: ReturnType<typeof useT>, status: string) {
  const key = statusKeys[status];
  return key ? t(key) : status;
}

function rowLine(t: ReturnType<typeof useT>, row: StudentReportRow) {
  const bits = [statusLabel(t, row.status)];
  if (row.score !== null && row.total !== null) {
    bits.push(t("report.score", { score: row.score, total: row.total }));
  }
  if (row.percent !== null) {
    bits.push(`${row.percent}%`);
  }
  if (row.detail) bits.push(row.detail);
  if (row.subjectName) bits.push(row.subjectName);
  bits.push(new Date(row.at).toLocaleString());
  return bits.join(" · ");
}

function ReportSection({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: StudentReportRow[];
}) {
  const t = useT();
  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {title}
      </h2>
      {items.length ? (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className="block rounded-2xl bg-background px-4 py-3"
              >
                <p className="font-heading text-base font-bold tracking-tight text-brand">
                  {t(kindKeys[item.kind])} · {item.title}
                </p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {rowLine(t, item)}
                </p>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-semibold text-muted">{empty}</p>
      )}
    </section>
  );
}

export function StudentReportView({
  desk,
  backHref,
  backLabel,
}: {
  desk: StudentReportDesk;
  backHref: string;
  backLabel: string;
}) {
  const t = useT();
  const report = desk.report;
  return (
    <div className="space-y-6">
      <p className="text-sm font-semibold">
        <a href={backHref} className="text-brand underline">
          {backLabel}
        </a>
      </p>
      {desk.learners.length > 1 ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t("report.choose")}
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {desk.learners.map((learner) => (
              <li key={learner.studentUserId}>
                <a
                  href={learner.href}
                  className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${
                    report?.studentUserId === learner.studentUserId
                      ? "bg-[#F3E6D0] text-[#294634]"
                      : "bg-background text-brand"
                  }`}
                >
                  {learner.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("report.for", { name: report.studentName })}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("report.live")}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="text-sm font-semibold text-muted">
                  {t("report.summary.quizzes")}
                </dt>
                <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                  {t("report.summary.passed_of", {
                    passed: report.summary.quizzesPassed,
                    total: report.summary.quizzesSat,
                  })}
                  {report.summary.quizzesPending
                    ? ` · ${t("report.summary.pending", {
                        count: report.summary.quizzesPending,
                      })}`
                    : ""}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="text-sm font-semibold text-muted">
                  {t("report.summary.exams")}
                </dt>
                <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                  {t("report.summary.passed_of", {
                    passed: report.summary.examsPassed,
                    total: report.summary.examsSat,
                  })}
                  {report.summary.examsPending
                    ? ` · ${t("report.summary.pending", {
                        count: report.summary.examsPending,
                      })}`
                    : ""}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="text-sm font-semibold text-muted">
                  {t("report.summary.homework")}
                </dt>
                <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                  {t("report.summary.homework_of", {
                    marked: report.summary.homeworkMarked,
                    submitted: report.summary.homeworkSubmitted,
                    assigned: report.summary.homeworkAssigned,
                  })}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="text-sm font-semibold text-muted">
                  {t("report.summary.practice")}
                </dt>
                <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                  {t("report.summary.practice_of", {
                    games: report.summary.gamesPlayed,
                    courses: report.summary.coursesStarted,
                    lessons: report.summary.lessonsCompleted,
                  })}
                </dd>
              </div>
            </dl>
          </section>
          <ReportSection
            title={t("report.kind.quiz")}
            empty={t("report.none.quiz")}
            items={report.quizzes}
          />
          <ReportSection
            title={t("report.kind.exam")}
            empty={t("report.none.exam")}
            items={report.exams}
          />
          <ReportSection
            title={t("report.kind.homework")}
            empty={t("report.none.homework")}
            items={report.homework}
          />
          <ReportSection
            title={t("report.kind.game")}
            empty={t("report.none.game")}
            items={report.games}
          />
          <ReportSection
            title={t("report.kind.course")}
            empty={t("report.none.course")}
            items={report.courses}
          />
          <ReportSection
            title={t("report.kind.lesson")}
            empty={t("report.none.lesson")}
            items={report.lessons}
          />
        </>
      ) : (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-muted">
            {desk.learners.length ? t("report.pick") : t("report.none.learners")}
          </p>
        </section>
      )}
    </div>
  );
}
