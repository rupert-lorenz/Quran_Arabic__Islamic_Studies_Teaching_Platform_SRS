"use client";

import Link from "next/link";
import { useState } from "react";
import { LibraryAudioPlayer } from "@/components/lms/library-audio-player";
import { LibraryBookReader } from "@/components/lms/library-book-reader";
import { LibraryVideoPlayer } from "@/components/lms/library-video-player";
import { useT } from "@/components/i18n/i18n-provider";
import { postJson } from "@/lib/api";
import { libraryCourseLessonHref } from "@/lib/library-materials";
import type { TeachingBookView } from "@/server/lms/library";
import type { PrerecordedCourseView } from "@/server/lms/prerecorded-courses";

const kindKeys = {
  video: "library.prerecorded.kind.video",
  audio: "library.prerecorded.kind.audio",
  pdf: "library.prerecorded.kind.pdf",
  flipbook: "library.prerecorded.kind.flipbook",
} as const;

const progressKeys = {
  not_started: "library.prerecorded.not_started",
  started: "library.prerecorded.started",
  completed: "library.prerecorded.done",
} as const;

export function LibraryCoursePlayer({
  course,
  currentId,
  book,
}: {
  course: PrerecordedCourseView;
  currentId: string | null;
  book: TeachingBookView | null;
}) {
  const t = useT();
  const [view, setView] = useState(course);
  const [pending, setPending] = useState(false);
  const index = view.lessons.findIndex((lesson) => lesson.id === currentId);
  const current = index >= 0 ? view.lessons[index] : view.lessons[0];
  const previous = index > 0 ? view.lessons[index - 1] : null;
  const next =
    index >= 0 && index < view.lessons.length - 1
      ? view.lessons[index + 1]
      : null;
  const studentUserId = view.progress.studentUserId;

  async function saveProgress(action: "complete" | "reopen", lessonId: string) {
    if (!view.progress.canRecord || pending) return;
    setPending(true);
    try {
      const nextView = await postJson<PrerecordedCourseView>(
        "/api/v1/library/prerecorded-courses/progress",
        {
          action,
          courseId: view.id,
          lessonId,
          studentUserId,
        },
      );
      setView(nextView);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        {book && current && !view.isLocked ? (
          book.viewKind === "audio" ? (
            <LibraryAudioPlayer
              item={book}
              onEnded={
                view.progress.canRecord
                  ? () => void saveProgress("complete", current.id)
                  : undefined
              }
            />
          ) : book.viewKind === "video" ? (
            <LibraryVideoPlayer
              item={book}
              onEnded={
                view.progress.canRecord
                  ? () => void saveProgress("complete", current.id)
                  : undefined
              }
            />
          ) : (
            <LibraryBookReader book={book} />
          )
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface p-6 text-sm font-semibold text-muted">
            {t("library.prerecorded.empty")}
          </p>
        )}
        {current ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {previous ? (
              <Link
                href={previous.readHref}
                className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-bold text-brand"
              >
                {t("library.prerecorded.prev")}
              </Link>
            ) : (
              <span />
            )}
            <p className="text-sm font-semibold text-muted">
              {t("library.prerecorded.lesson_of", {
                current: index + 1,
                count: view.lessons.length,
              })}
            </p>
            {next ? (
              <Link
                href={next.readHref}
                onClick={() => {
                  if (view.progress.canRecord && current.progress !== "completed") {
                    void saveProgress("complete", current.id);
                  }
                }}
                className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-bold text-white"
              >
                {t("library.prerecorded.next")}
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
        {current && view.progress.canRecord ? (
          <div className="mt-4">
            {current.progress === "completed" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void saveProgress("reopen", current.id)}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold text-brand"
              >
                {t("library.prerecorded.mark_open")}
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => void saveProgress("complete", current.id)}
                className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-bold text-brand"
              >
                {t("library.prerecorded.mark_done")}
              </button>
            )}
          </div>
        ) : null}
      </div>
      <aside className="rounded-[2rem] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-lg font-bold tracking-tight text-brand">
          {t("library.prerecorded.progress")}
        </h2>
        {view.progress.studentName && view.progress.learners.length > 1 ? (
          <p className="mt-2 text-sm font-semibold text-muted">
            {view.progress.studentName}
          </p>
        ) : null}
        <p className="mt-2 text-sm font-semibold text-muted">
          {view.progress.percent === 100
            ? t("library.prerecorded.complete")
            : t("library.prerecorded.progress_of", {
                completed: view.progress.completedCount,
                count: view.lessonCount,
              })}
          {` · ${t("library.prerecorded.progress_pct", {
            percent: view.progress.percent,
          })}`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${view.progress.percent}%` }}
          />
        </div>
        {view.progress.learners.length > 1 ? (
          <ul className="mt-3 grid gap-1">
            {view.progress.learners.map((learner) => (
              <li key={learner.studentUserId}>
                <Link
                  href={libraryCourseLessonHref(
                    view.id,
                    current?.id ?? view.lessons[0]?.id ?? view.id,
                    learner.studentUserId,
                  )}
                  className={`text-sm font-semibold ${
                    learner.studentUserId === studentUserId
                      ? "text-brand"
                      : "text-muted underline"
                  }`}
                >
                  {learner.studentName}
                  {` · ${t("library.prerecorded.progress_of", {
                    completed: learner.completedCount,
                    count: view.lessonCount,
                  })}`}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <h3 className="mt-6 font-heading text-lg font-bold tracking-tight text-brand">
          {t("library.prerecorded.lessons", { count: view.lessons.length })}
        </h3>
        <ol className="mt-4 grid gap-2">
          {view.lessons.map((lesson, lessonIndex) => {
            const active = lesson.id === current?.id;
            return (
              <li key={lesson.id}>
                <Link
                  href={lesson.readHref}
                  className={`block rounded-2xl px-3 py-3 text-sm font-semibold ${
                    active ? "bg-gold text-brand" : "bg-background text-muted"
                  }`}
                >
                  {lessonIndex + 1}. {lesson.title}
                  <span className="mt-1 block text-xs">
                    {lesson.contentKind
                      ? `${t(kindKeys[lesson.contentKind])} · `
                      : ""}
                    {t(progressKeys[lesson.progress])}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
