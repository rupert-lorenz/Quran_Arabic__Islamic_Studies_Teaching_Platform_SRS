"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClassroomJoinButton } from "@/components/classroom/classroom-join-button";
import { getJson, postJson } from "@/lib/api";
import type { GroupLessonView } from "@/server/booking/group-lessons";

type RosterRow = {
  id: string;
  studentName: string;
  status: string;
  waitlistPosition?: number | null;
};

export function GroupLessonManager({
  initial,
}: {
  initial: GroupLessonView[];
}) {
  const [lessons, setLessons] = useState(initial);
  const initialKey = initial.map((row) => `${row.id}:${row.status}`).join("|");
  const [seenKey, setSeenKey] = useState(initialKey);
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setLessons(initial);
  }
  const [rosters, setRosters] = useState<Record<string, RosterRow[]>>({});
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function loadRoster(id: string) {
    setPending(`roster:${id}`);
    setError("");
    try {
      const result = await getJson<{ roster: RosterRow[] }>(
        `/api/v1/group-lessons/${id}`,
      );
      setRosters((current) => ({ ...current, [id]: result.roster }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load roster");
    } finally {
      setPending("");
    }
  }

  async function record(
    lessonId: string,
    enrollmentId: string,
    status: "completed" | "no_show",
  ) {
    setPending(`${status}:${enrollmentId}`);
    setError("");
    try {
      await postJson(
        `/api/v1/group-lessons/${lessonId}/enrollments/${enrollmentId}/complete`,
        { status },
      );
      await loadRoster(lessonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record attendance");
      setPending("");
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-extrabold text-brand">Your published classes</h2>
      {lessons.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {lessons.map((lesson) => (
            <article
              key={lesson.id}
              id={`group-${lesson.id}`}
              className="scroll-mt-24 rounded-[1.5rem] border border-line bg-surface p-5"
            >
              <p className="text-xs font-bold uppercase text-brand-soft">
                {lesson.subjectName} · {lesson.status}
                {lesson.seriesTotal
                  ? ` · Session ${lesson.seriesIndex}/${lesson.seriesTotal}`
                  : ""}
              </p>
              <h3 className="mt-1 text-xl font-extrabold text-brand">{lesson.title}</h3>
              <p className="mt-2 font-semibold text-brand">{lesson.whenLabel}</p>
              {lesson.scheduleLabel ? (
                <p className="mt-1 text-sm font-semibold text-muted">
                  {lesson.scheduleLabel}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {lesson.enrolledCount}/{lesson.capacity} enrolled
                {lesson.waitlistCount
                  ? ` · ${lesson.waitlistCount} waiting`
                  : ""}{" "}
                · min {lesson.minStudents}
                {lesson.isUnderEnrolled
                  ? ` · ${lesson.studentsNeeded} more needed to run`
                  : " · minimum reached"}{" "}
                · {lesson.studentPriceFormatted} per session
                {lesson.seriesSessionCount > 1
                  ? ` · ${lesson.seriesTotalFormatted} series total`
                  : ""}
                {lesson.teacherPaymentFormatted
                  ? ` · teacher ${lesson.teacherPaymentFormatted}/session`
                  : ""}
                {lesson.teacherPaymentSeriesFormatted &&
                lesson.seriesSessionCount > 1
                  ? ` · ${lesson.teacherPaymentSeriesFormatted} teacher series`
                  : ""}{" "}
                ·{" "}
                {lesson.level.replaceAll("_", " ")}
                {lesson.minAge != null || lesson.maxAge != null
                  ? ` · Ages ${lesson.minAge ?? "any"}–${lesson.maxAge ?? "any"}`
                  : " · All ages"}
              </p>
              {lesson.visibleFromLabel || lesson.applicationDeadlineLabel ? (
                <p className="mt-1 text-sm text-muted">
                  {lesson.isVisible
                    ? "Visible to families"
                    : `Hidden until ${lesson.visibleFromLabel}`}
                  {lesson.applicationDeadlineLabel
                    ? lesson.isOpenForEnrolment
                      ? ` · Apply by ${lesson.applicationDeadlineLabel}`
                      : " · Applications closed"
                    : ""}
                </p>
              ) : null}
              {lesson.status === "published" && !lesson.isVisible ? (
                <p className="mt-2 rounded-2xl bg-mint px-3 py-2 text-sm font-semibold text-brand">
                  Families cannot see this class yet.
                </p>
              ) : null}
              {lesson.status === "published" && lesson.isUnderEnrolled ? (
                <p className="mt-2 rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-brand">
                  This class will be cancelled at start time if fewer than{" "}
                  {lesson.minStudents} students are enrolled.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <ClassroomJoinButton
                  href={lesson.classroomHref}
                  joinable={lesson.classroomJoinable}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => void loadRoster(lesson.id)}
                >
                  {pending === `roster:${lesson.id}` ? "Loading…" : "View roster"}
                </Button>
                {lesson.status === "published" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={Boolean(pending)}
                    onClick={async () => {
                      if (!window.confirm("Cancel this group lesson for every student?")) {
                        return;
                      }
                      setPending(`cancel:${lesson.id}`);
                      setError("");
                      try {
                        await postJson(`/api/v1/group-lessons/${lesson.id}/cancel`, {});
                        setLessons((current) =>
                          current.map((item) =>
                            item.id === lesson.id
                              ? { ...item, status: "cancelled" }
                              : item,
                          ),
                        );
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Could not cancel class",
                        );
                      } finally {
                        setPending("");
                      }
                    }}
                  >
                    {pending === `cancel:${lesson.id}` ? "Cancelling…" : "Cancel class"}
                  </Button>
                ) : null}
                {lesson.status === "published" && lesson.seriesId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={Boolean(pending)}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Cancel this class and every following class in the series?",
                        )
                      ) {
                        return;
                      }
                      setPending(`cancel-series:${lesson.id}`);
                      setError("");
                      try {
                        await postJson(
                          `/api/v1/group-lessons/${lesson.id}/series/cancel`,
                          {},
                        );
                        const cutoff = new Date(lesson.startsAt).getTime();
                        setLessons((current) =>
                          current.map((item) =>
                            item.seriesId === lesson.seriesId &&
                            new Date(item.startsAt).getTime() >= cutoff
                              ? { ...item, status: "cancelled" }
                              : item,
                          ),
                        );
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not cancel class series",
                        );
                      } finally {
                        setPending("");
                      }
                    }}
                  >
                    {pending === `cancel-series:${lesson.id}`
                      ? "Cancelling…"
                      : "Cancel remaining series"}
                  </Button>
                ) : null}
              </div>
              {rosters[lesson.id] ? (
                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {rosters[lesson.id].length ? (
                    rosters[lesson.id].map((row) => (
                      <li key={row.id} className="rounded-2xl bg-background px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-brand">{row.studentName}</p>
                            <p className="text-xs uppercase text-muted">
                              {row.status === "waitlisted" && row.waitlistPosition
                                ? `Waiting list #${row.waitlistPosition}`
                                : row.status.replaceAll("_", " ")}
                            </p>
                          </div>
                          {row.status === "confirmed" ? (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={Boolean(pending)}
                                onClick={() => void record(lesson.id, row.id, "completed")}
                              >
                                Completed
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={Boolean(pending)}
                                onClick={() => void record(lesson.id, row.id, "no_show")}
                              >
                                No show
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted">No students enrolled yet.</li>
                  )}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-gold px-4 py-3 font-semibold text-brand">
          No group lessons published yet. After you publish, they appear
          here. Families then enrol from Group lessons. If fewer than the
          minimum students have enrolled by start time, the class is cancelled.
        </p>
      )}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </section>
  );
}
