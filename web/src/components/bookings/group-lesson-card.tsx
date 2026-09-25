"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClassroomJoinButton } from "@/components/classroom/classroom-join-button";
import { fieldClass, postJson } from "@/lib/api";
import type { GroupLessonView } from "@/server/booking/group-lessons";
import type { UiMessageKey } from "@/lib/i18n";

type Viewer = {
  roleKey: string;
  userId: string;
  children: { userId: string; displayName: string }[];
  parentManaged: boolean;
} | null;

type CardEnrollment = {
  id: string;
  studentUserId: string;
  status?: "confirmed" | "waitlisted" | string;
  waitlistPosition?: number | null;
};

export function GroupLessonCard({
  lesson,
  viewer,
  enrollments = [],
  layout = "full",
}: {
  lesson: GroupLessonView;
  viewer: Viewer;
  enrollments?: CardEnrollment[];
  layout?: "full" | "session";
}) {
  const t = useT();
  const [studentUserId, setStudentUserId] = useState(
    viewer?.roleKey === "parent"
      ? viewer.children[0]?.userId ?? ""
      : viewer?.userId ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [currentLesson, setCurrentLesson] = useState(lesson);
  const [activeEnrollments, setActiveEnrollments] = useState(enrollments);
  const enrollment = activeEnrollments.find(
    (item) => item.studentUserId === studentUserId,
  );
  const onWaitlist = enrollment?.status === "waitlisted";
  const reserved = enrollment && !onWaitlist;
  const canClaimWaitlist =
    onWaitlist && !currentLesson.isFull && currentLesson.isOpenForEnrolment;
  const canEnrol =
    viewer?.roleKey === "parent" ||
    (viewer?.roleKey === "student" && !viewer.parentManaged);
  const compact = layout === "session";
  const ageLabel =
    lesson.minAge != null && lesson.maxAge != null
      ? t("group.age_range", { min: lesson.minAge, max: lesson.maxAge })
      : lesson.minAge != null
        ? t("group.age_minimum", { min: lesson.minAge })
        : lesson.maxAge != null
          ? t("group.age_maximum", { max: lesson.maxAge })
          : t("group.all_ages");

  return (
    <article
      id={`group-${lesson.id}`}
      className="flex h-full scroll-mt-24 flex-col rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
    >
      {compact ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-soft">
              {lesson.seriesTotal
                ? t("group.session", {
                    index: lesson.seriesIndex ?? 1,
                    total: lesson.seriesTotal,
                  })
                : t("group.badge")}
            </p>
            <h3 className="mt-1 font-heading text-xl font-bold tracking-tight text-brand">
              {lesson.whenLabel}
            </h3>
          </div>
          <span className="text-sm font-bold text-brand-soft">
            {currentLesson.placesLeft} {t("group.places_left")}
            {currentLesson.waitlistCount
              ? ` · ${t("group.waitlist_count", {
                  count: currentLesson.waitlistCount,
                })}`
              : ""}
          </span>
        </div>
      ) : (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-extrabold uppercase text-brand">
          {t("group.badge")}
          {lesson.seriesTotal
            ? ` · ${t("group.session", {
                index: lesson.seriesIndex ?? 1,
                total: lesson.seriesTotal,
              })}`
            : ""}
        </span>
        <span className="text-sm font-bold text-brand-soft">
          {currentLesson.placesLeft} {t("group.places_left")}
          {currentLesson.waitlistCount
            ? ` · ${t("group.waitlist_count", {
                count: currentLesson.waitlistCount,
              })}`
            : ""}
        </span>
      </div>
      )}
      {compact ? null : (
        <>
      <h2 className="mt-4 text-2xl font-extrabold text-brand">{lesson.title}</h2>
      <p className="mt-1 font-bold text-brand-soft">{lesson.subjectName}</p>
      {lesson.description ? (
        <p className="mt-3 text-sm leading-6 text-muted">{lesson.description}</p>
      ) : null}
      <dl className="mt-5 grid gap-2 text-sm">
        <div className="rounded-2xl bg-background px-4 py-3">
          <dt className="font-bold text-muted">{t("group.teacher")}</dt>
          <dd className="font-extrabold text-brand">{lesson.teacherName}</dd>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <dt className="font-bold text-muted">{t("group.when")}</dt>
          <dd className="font-extrabold text-brand">{lesson.whenLabel}</dd>
          {lesson.scheduleLabel ? (
            <dd className="mt-1 text-xs font-semibold text-muted">
              {t("group.schedule")}: {lesson.scheduleLabel}
            </dd>
          ) : null}
          {lesson.teacherWhenLabel ? (
            <dd className="text-xs text-muted">
              {lesson.teacherWhenLabel} ({lesson.teacherTimezone})
            </dd>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-background px-4 py-3">
            <dt className="font-bold text-muted">{t("group.length")}</dt>
            <dd className="font-extrabold text-brand">
              {lesson.durationMinutes} {t("booking.minutes")}
            </dd>
          </div>
          <div className="rounded-2xl bg-gold/60 px-4 py-3">
            <dt className="font-bold text-muted">{t("group.price")}</dt>
            <dd className="font-extrabold text-brand">
              {t("group.price_per_session", {
                price: lesson.studentPriceFormatted,
              })}
            </dd>
            {lesson.seriesSessionCount > 1 ? (
              <dd className="mt-1 text-xs font-semibold text-muted">
                {t("group.series_total", {
                  sessions: lesson.seriesSessionCount,
                  total: lesson.seriesTotalFormatted,
                })}
              </dd>
            ) : null}
            {lesson.listedPriceFormatted ? (
              <dd className="mt-1 text-xs font-semibold text-muted">
                {t("group.listed_price", { price: lesson.listedPriceFormatted })}
              </dd>
            ) : null}
          </div>
        </div>
        {lesson.applicationDeadlineLabel || !lesson.isOpenForEnrolment ? (
          <div className="rounded-2xl bg-background px-4 py-3">
            <dt className="font-bold text-muted">{t("group.apply_by")}</dt>
            <dd className="font-extrabold text-brand">
              {lesson.isOpenForEnrolment && lesson.applicationDeadlineLabel
                ? t("group.applications_open_until", {
                    when: lesson.applicationDeadlineLabel,
                  })
                : t("group.applications_closed")}
            </dd>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-background px-4 py-3">
            <dt className="font-bold text-muted">{t("group.level")}</dt>
            <dd className="font-extrabold text-brand">
              {t(`group.level_${lesson.level}` as UiMessageKey)}
            </dd>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <dt className="font-bold text-muted">{t("group.ages")}</dt>
            <dd className="font-extrabold text-brand">{ageLabel}</dd>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-background px-4 py-3">
            <dt className="font-bold text-muted">{t("group.capacity")}</dt>
            <dd className="font-extrabold text-brand">
              {currentLesson.enrolledCount}/{currentLesson.capacity}
            </dd>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <dt className="font-bold text-muted">{t("group.minimum")}</dt>
            <dd className="font-extrabold text-brand">
              {t("group.minimum_students", { min: lesson.minStudents })}
            </dd>
            <dd className="mt-1 text-xs font-semibold text-muted">
              {lesson.isUnderEnrolled
                ? t("group.needs_students", { count: lesson.studentsNeeded })
                : t("group.meets_minimum")}
            </dd>
          </div>
        </div>
      </dl>
        </>
      )}
      <div className="mt-auto pt-5">
        <ClassroomJoinButton
          className="mb-3 w-full"
          href={currentLesson.classroomHref}
          joinable={
            currentLesson.classroomJoinable &&
            Boolean(
              reserved ||
                (viewer?.roleKey === "teacher" &&
                  viewer.userId === lesson.teacherUserId) ||
                viewer?.roleKey === "staff",
            )
          }
        />
        {!viewer ? (
          <ButtonLink href="/login" className="w-full">
            {t("group.sign_in")}
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
                const result = await postJson<{
                  enrollmentId: string;
                  status?: "confirmed" | "waitlisted";
                  waitlistPosition?: number | null;
                  lesson?: GroupLessonView;
                }>(`/api/v1/group-lessons/${lesson.id}/enroll`, {
                  studentUserId,
                });
                if (result.lesson) setCurrentLesson(result.lesson);
                setActiveEnrollments((current) => [
                  ...current.filter((item) => item.studentUserId !== studentUserId),
                  {
                    id: result.enrollmentId,
                    studentUserId,
                    status: result.status ?? "confirmed",
                    waitlistPosition: result.waitlistPosition ?? null,
                  },
                ]);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : currentLesson.isFull
                      ? t("group.waitlist_failed")
                      : t("group.enrol_failed"),
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {viewer.roleKey === "parent" ? (
              <select
                className={fieldClass}
                value={studentUserId}
                onChange={(event) => setStudentUserId(event.target.value)}
                aria-label={t("booking.child")}
              >
                {viewer.children.map((child) => (
                  <option key={child.userId} value={child.userId}>
                    {child.displayName}
                  </option>
                ))}
              </select>
            ) : null}
            {onWaitlist ? (
              <p className="rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand">
                {enrollment.waitlistPosition
                  ? t("group.waitlist_position", {
                      position: enrollment.waitlistPosition,
                    })
                  : t("group.on_waitlist")}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={
                pending ||
                reserved ||
                (onWaitlist && !canClaimWaitlist) ||
                !currentLesson.isOpenForEnrolment ||
                !studentUserId
              }
            >
              {reserved
                ? t("group.enrolled")
                : canClaimWaitlist
                  ? pending
                    ? t("group.enrolling")
                    : t("group.claim_place")
                  : onWaitlist
                    ? t("group.on_waitlist")
                    : !currentLesson.isOpenForEnrolment
                      ? t("group.applications_closed")
                      : pending
                        ? currentLesson.isFull
                          ? t("group.waitlisting")
                          : t("group.enrolling")
                        : currentLesson.isFull
                          ? t("group.waitlist")
                          : t("group.enrol")}
            </Button>
            <p className="text-xs font-semibold text-muted">
              {t("group.enrol_price_note", {
                price: currentLesson.studentPriceFormatted,
              })}
            </p>
            {enrollment ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    const result = await postJson<{
                      lesson?: GroupLessonView;
                      promotedEnrollmentId?: string | null;
                    }>(
                      `/api/v1/group-lessons/${lesson.id}/enrollments/${enrollment.id}/cancel`,
                      {},
                    );
                    setActiveEnrollments((current) =>
                      current
                        .filter((item) => item.id !== enrollment.id)
                        .map((item) =>
                          item.id === result.promotedEnrollmentId
                            ? {
                                ...item,
                                status: "confirmed",
                                waitlistPosition: null,
                              }
                            : item,
                        ),
                    );
                    if (result.lesson) setCurrentLesson(result.lesson);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : onWaitlist
                          ? t("group.leave_waitlist_failed")
                          : t("group.cancel_failed"),
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {onWaitlist ? t("group.leave_waitlist") : t("group.cancel_place")}
              </Button>
            ) : null}
          </form>
        ) : (
          <p className="text-sm font-semibold text-muted">{t("group.cannot_enrol")}</p>
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
