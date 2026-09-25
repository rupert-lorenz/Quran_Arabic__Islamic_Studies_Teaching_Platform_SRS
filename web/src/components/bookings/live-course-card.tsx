"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import type { LiveCourseView } from "@/server/booking/live-courses";

type Viewer = {
  roleKey: string;
  userId: string;
  children: { userId: string; displayName: string }[];
  parentManaged: boolean;
} | null;

export function LiveCourseCard({
  course,
  viewer,
}: {
  course: LiveCourseView;
  viewer: Viewer;
}) {
  const t = useT();
  const [studentUserId, setStudentUserId] = useState(
    viewer?.roleKey === "parent"
      ? viewer.children[0]?.userId ?? ""
      : viewer?.userId ?? "",
  );
  const [pending, setPending] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState("");
  const canEnrol =
    viewer?.roleKey === "parent" ||
    (viewer?.roleKey === "student" && !viewer.parentManaged);

  return (
    <article className="flex h-full flex-col rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="rounded-full bg-gold px-3 py-1 text-xs font-extrabold uppercase text-brand">
          {t("live.badge")}
        </span>
        <span className="text-sm font-bold text-brand-soft">
          {course.placesLeft} {t("group.places_left")}
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-extrabold text-brand">{course.title}</h2>
      <p className="mt-1 font-bold text-brand-soft">
        {course.subjectName} · {course.teacherName}
      </p>
      {course.description ? (
        <p className="mt-3 text-sm leading-6 text-muted">{course.description}</p>
      ) : null}
      <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-background px-4 py-3">
          <dt className="font-bold text-muted">{t("live.sessions")}</dt>
          <dd className="font-extrabold text-brand">{course.sessionCount}</dd>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <dt className="font-bold text-muted">{t("group.length")}</dt>
          <dd className="font-extrabold text-brand">
            {course.durationMinutes} {t("booking.minutes")}
          </dd>
        </div>
        <div className="col-span-2 rounded-2xl bg-mint px-4 py-3">
          <dt className="font-bold text-muted">{t("live.first_session")}</dt>
          <dd className="font-extrabold text-brand">{course.firstWhenLabel}</dd>
        </div>
        <div className="col-span-2 rounded-2xl bg-gold/60 px-4 py-3">
          <dt className="font-bold text-muted">{t("live.course_price")}</dt>
          <dd className="font-extrabold text-brand">{course.amountFormatted}</dd>
        </div>
      </dl>
      <details className="mt-4 rounded-2xl bg-background px-4 py-3">
        <summary className="cursor-pointer font-bold text-brand">
          {t("live.schedule")}
        </summary>
        <ol className="mt-3 space-y-1 text-sm text-muted">
          {course.sessions.map((session) => (
            <li key={session.id}>
              {session.index}. {session.whenLabel}
            </li>
          ))}
        </ol>
      </details>
      <div className="mt-auto pt-5">
        {!viewer ? (
          <ButtonLink href="/login" className="w-full">
            {t("live.sign_in")}
          </ButtonLink>
        ) : viewer.roleKey === "parent" && !viewer.children.length ? (
          <ButtonLink href="/family/children/new" className="w-full">
            {t("group.add_child")}
          </ButtonLink>
        ) : canEnrol ? (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              try {
                await postJson(`/api/v1/live-courses/${course.id}/enroll`, {
                  studentUserId,
                });
                setEnrolled(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : t("live.enrol_failed"));
              } finally {
                setPending(false);
              }
            }}
          >
            {viewer.roleKey === "parent" ? (
              <select
                value={studentUserId}
                onChange={(event) => setStudentUserId(event.target.value)}
                className={fieldClass}
                aria-label={t("booking.child")}
              >
                {viewer.children.map((child) => (
                  <option key={child.userId} value={child.userId}>
                    {child.displayName}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              className="w-full"
              disabled={pending || enrolled || course.isFull || !studentUserId}
            >
              {enrolled
                ? t("live.enrolled")
                : course.isFull
                  ? t("group.full")
                  : pending
                    ? t("group.enrolling")
                    : t("live.enrol")}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted">{t("group.cannot_enrol")}</p>
        )}
        {error ? (
          <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
