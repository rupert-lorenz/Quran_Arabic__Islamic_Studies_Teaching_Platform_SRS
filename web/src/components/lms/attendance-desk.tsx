"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LessonHistoryList } from "@/components/learning/lesson-history-list";
import type { AttendanceDesk } from "@/server/lms/attendance";

export function AttendanceDeskView({ desk }: { desk: AttendanceDesk }) {
  const t = useT();
  const profile = desk.profile;

  return (
    <div className="space-y-8">
      {desk.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("attendance.choose")}
          {": "}
          {desk.learners.map((learner, index) => (
            <span key={learner.studentUserId}>
              {index ? " · " : null}
              <a href={learner.href} className="text-brand underline">
                {learner.name}
              </a>
            </span>
          ))}
        </p>
      ) : null}

      {profile ? (
        <>
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
              {t("attendance.for", { name: profile.studentName })}
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
              {t("attendance.rate_line", { rate: profile.summary.rate })}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("attendance.present")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.summary.completed}
                </p>
              </article>
              <article className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("attendance.missed")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.summary.noShow}
                </p>
              </article>
              <article className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("attendance.scheduled")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.summary.scheduledMinutes}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("attendance.minutes_line", {
                    minutes: profile.summary.scheduledMinutes,
                  })}
                </p>
              </article>
              <article className="rounded-2xl bg-[#F3E6D0] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                  {t("attendance.attended")}
                </p>
                <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
                  {profile.summary.attendedMinutes}
                </p>
                <p className="mt-1 text-sm text-brand/80">
                  {t("attendance.minutes_line", {
                    minutes: profile.summary.attendedMinutes,
                  })}
                </p>
              </article>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#F3F4F2]">
              <div
                className="h-full rounded-full bg-[#CB9F64]"
                style={{ width: `${Math.min(100, profile.summary.rate)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">{t("attendance.rate_help")}</p>
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("attendance.lessons")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("attendance.lessons_help")}</p>
            <div className="mt-4">
              <LessonHistoryList
                lessons={profile.lessons}
                emptyText={t("attendance.none.events")}
              />
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {desk.learners.length ? t("attendance.pick") : t("attendance.none.learners")}
        </p>
      )}

      {desk.learners.length > 1 ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("attendance.board")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("attendance.board_help")}</p>
          <ol className="mt-4 grid gap-2">
            {desk.learners.slice(0, 12).map((learner, index) => (
              <li key={learner.studentUserId}>
                <a
                  href={learner.href}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background px-4 py-3"
                >
                  <span className="font-heading font-bold tracking-tight text-brand">
                    {index + 1}. {learner.name}
                  </span>
                  <span className="text-sm font-semibold text-muted">
                    {t("attendance.rate_line", { rate: learner.rate })}
                    {" · "}
                    {t("attendance.minutes_line", {
                      minutes: learner.attendedMinutes,
                    })}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
