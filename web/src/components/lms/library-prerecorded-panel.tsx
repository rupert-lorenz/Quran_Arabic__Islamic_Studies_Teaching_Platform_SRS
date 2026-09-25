"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import { fieldClass, postJson } from "@/lib/api";
import { LIBRARY_ACCESS_MODES } from "@/lib/library-materials";
import type { PrerecordedCourseDesk } from "@/server/lms/prerecorded-courses";

const contentKindKeys = {
  video: "library.prerecorded.kind.video",
  audio: "library.prerecorded.kind.audio",
  pdf: "library.prerecorded.kind.pdf",
  flipbook: "library.prerecorded.kind.flipbook",
} as const;

const accessKeys = {
  open: "library.access.open",
  entitled: "library.access.entitled",
} as const;

const statusKeys = {
  draft: "library.status.draft",
  published: "library.status.published",
  archived: "library.status.archived",
} as const;

export function LibraryPrerecordedPanel({
  initial,
}: {
  initial: PrerecordedCourseDesk;
}) {
  const t = useT();
  const [desk, setDesk] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function run(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<PrerecordedCourseDesk>(
        "/api/v1/library/prerecorded-courses",
        body,
      );
      setDesk(next);
      setMessage(t("library.prerecorded.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  function onForm(action: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = Object.fromEntries(new FormData(form).entries());
      void run({ action, ...body });
      form.reset();
    };
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.prerecorded.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.prerecorded.help")}
      </p>

      <form className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={onForm("create")}>
        <input name="title" required placeholder={t("library.prerecorded.name")} className={fieldClass} />
        <input name="description" placeholder={t("library.description")} className={fieldClass} />
        <select name="subjectSlug" className={fieldClass} defaultValue="">
          <option value="">{t("library.any_subject")}</option>
          {desk.subjects.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
        <select name="accessMode" className={fieldClass} defaultValue="entitled">
          {LIBRARY_ACCESS_MODES.map((value) => (
            <option key={value} value={value}>
              {t(accessKeys[value])}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {t("library.prerecorded.create")}
        </Button>
      </form>

      {desk.courses.length ? (
        <ul className="mt-6 grid gap-4">
          {desk.courses.map((course) => (
            <li key={course.id} className="rounded-2xl bg-background px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold tracking-tight text-brand">
                    {course.title}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {t(statusKeys[course.status])}
                    {` · ${t(accessKeys[course.accessMode])}`}
                    {course.subjectName ? ` · ${course.subjectName}` : ""}
                    {` · ${t("library.prerecorded.lessons", { count: course.lessons.length })}`}
                  </p>
                  {course.description ? (
                    <p className="mt-1 text-sm font-semibold text-muted">{course.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {course.status !== "published" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        void run({
                          action: "set_status",
                          courseId: course.id,
                          status: "published",
                        })
                      }
                    >
                      {t("library.publish")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        void run({
                          action: "set_status",
                          courseId: course.id,
                          status: "archived",
                        })
                      }
                    >
                      {t("library.archive")}
                    </Button>
                  )}
                </div>
              </div>

              <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={onForm("add_lesson")}>
                <input type="hidden" name="courseId" value={course.id} />
                <select name="materialId" required className={fieldClass} defaultValue="">
                  <option value="">{t("library.prerecorded.material")}</option>
                  {desk.materials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {` · ${t(contentKindKeys[item.contentKind])}`}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={pending} className="md:col-span-2">
                  {t("library.prerecorded.add_lesson")}
                </Button>
              </form>

              {course.lessons.length ? (
                <ul className="mt-3 grid gap-2">
                  {course.lessons.map((lesson, index) => (
                    <li
                      key={lesson.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-muted"
                    >
                      <span>
                        {index + 1}. {lesson.title}
                        {lesson.contentKind
                          ? ` · ${t(contentKindKeys[lesson.contentKind])}`
                          : ""}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          void run({ action: "remove_lesson", lessonId: lesson.id })
                        }
                      >
                        {t("library.prerecorded.remove_lesson")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={onForm("enroll")}>
                <input type="hidden" name="courseId" value={course.id} />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder={t("library.prerecorded.email")}
                  className={fieldClass}
                />
                <input name="expiresAt" type="date" className={fieldClass} />
                <Button type="submit" disabled={pending}>
                  {t("library.prerecorded.enroll")}
                </Button>
              </form>

              {course.enrollments.length ? (
                <ul className="mt-3 grid gap-2">
                  {course.enrollments.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-muted"
                    >
                      <span>
                        {row.studentName}
                        {` · ${t("library.prerecorded.progress_of", {
                          completed: row.completedCount,
                          count: course.lessons.length,
                        })}`}
                        {` · `}
                        <LibraryExpiryLabel expiresAt={row.expiresAt} />
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          void run({ action: "revoke", enrollmentId: row.id })
                        }
                      >
                        {t("library.prerecorded.revoke")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">
          {t("library.prerecorded.none")}
        </p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
