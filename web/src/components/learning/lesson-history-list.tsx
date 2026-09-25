import { ButtonLink } from "@/components/ui/button";
import type {
  LessonHistorySummary,
  LessonHistoryView,
} from "@/lib/lesson-history";
import { formatLessonWhen } from "@/lib/lesson-history";

export function LessonHistorySummaryText({
  summary,
}: {
  summary: LessonHistorySummary;
}) {
  if (!summary.total) {
    return <p className="text-sm leading-6 text-muted">No lessons yet.</p>;
  }
  return (
    <p className="text-sm font-semibold text-brand">
      {summary.completed} completed
      {summary.cancelled ? ` · ${summary.cancelled} cancelled` : ""}
      {summary.noShow ? ` · ${summary.noShow} missed` : ""}
      {summary.scheduledMinutes
        ? ` · ${summary.attendedMinutes} of ${summary.scheduledMinutes} min attended`
        : ""}
      {summary.completed || summary.noShow
        ? ` · ${summary.rate}% present`
        : ""}
      {summary.lastLessonAt
        ? ` · Last ${formatLessonWhen(summary.lastLessonAt)}`
        : ""}
    </p>
  );
}

export function LessonHistoryList({
  lessons,
  emptyText,
  manageHref,
  manageLabel,
}: {
  lessons: LessonHistoryView[];
  emptyText?: string;
  manageHref?: string;
  manageLabel?: string;
}) {
  return (
    <div>
      {manageHref ? (
        <div className="mb-4">
          <ButtonLink href={manageHref} variant="secondary">
            {manageLabel ?? "View lesson history"}
          </ButtonLink>
        </div>
      ) : null}
      {lessons.length ? (
        <ul className="grid gap-3">
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              className="rounded-2xl bg-mint px-4 py-4 text-sm font-semibold text-brand"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">{lesson.title}</p>
                  <p className="mt-1 text-muted">
                    {lesson.whenLabel}
                    {lesson.subjectName ? ` · ${lesson.subjectName}` : ""}
                    {lesson.teacherName ? ` · ${lesson.teacherName}` : ""}
                    {` · ${lesson.attendedMinutes} of ${lesson.durationMinutes} min`}
                  </p>
                </div>
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wide">
                  {lesson.statusLabel}
                </span>
              </div>
              {lesson.notes ? (
                <p className="mt-2 text-sm leading-6 text-muted">{lesson.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted">
          {emptyText ??
            "Lesson history will appear here after a class is recorded."}
        </p>
      )}
    </div>
  );
}
