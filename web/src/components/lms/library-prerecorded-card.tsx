"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import type { PrerecordedCourseView } from "@/server/lms/prerecorded-courses";

export function LibraryPrerecordedCard({
  courses,
}: {
  courses: PrerecordedCourseView[];
}) {
  const t = useT();
  if (!courses.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("library.prerecorded.yours")}
      </h3>
      <ul className="mt-3 grid gap-2">
        {courses.map((item) => (
          <li key={item.id} className="text-sm font-semibold text-muted">
            {item.isLocked ? (
              <span>
                {item.title}
                {` · ${t("library.prerecorded.locked")}`}
              </span>
            ) : (
              <a href={item.href} className="text-brand underline">
                {item.title}
                {` · ${t("library.prerecorded.lessons", { count: item.lessonCount })}`}
                {item.progress.canRecord
                  ? ` · ${
                      item.progress.percent === 100
                        ? t("library.prerecorded.complete")
                        : t("library.prerecorded.progress_of", {
                            completed: item.progress.completedCount,
                            count: item.lessonCount,
                          })
                    }`
                  : ""}
                {` · `}
                <LibraryExpiryLabel expiresAt={item.expiresAt} />
              </a>
            )}
            {item.progress.learners.length > 1 ? (
              <ul className="mt-1 grid gap-1">
                {item.progress.learners.map((learner) => (
                  <li key={learner.studentUserId}>
                    {learner.studentName}
                    {` · ${t("library.prerecorded.progress_of", {
                      completed: learner.completedCount,
                      count: item.lessonCount,
                    })}`}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
