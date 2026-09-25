export const DEFAULT_LESSON_DURATION_MINUTES = 30;
export const MIN_LESSON_DURATION_MINUTES = 15;
export const MAX_LESSON_DURATION_MINUTES = 180;
export const LESSON_HISTORY_PAGE_SIZE = 50;

export const lessonHistoryStatuses = [
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "Did not attend" },
] as const;

export type LessonHistoryStatus = (typeof lessonHistoryStatuses)[number]["value"];

const statusValues = new Set(lessonHistoryStatuses.map((item) => item.value));

export function normalizeLessonHistoryStatus(value?: string | null) {
  const status = value?.trim().toLowerCase() ?? "";
  return statusValues.has(status as LessonHistoryStatus)
    ? (status as LessonHistoryStatus)
    : null;
}

export function lessonHistoryStatusLabel(value?: string | null) {
  return (
    lessonHistoryStatuses.find((item) => item.value === value)?.label ?? null
  );
}

export function parseLessonStartedAt(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
      ? `${trimmed}:00.000Z`
      : trimmed,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLessonWhen(value?: Date | string | null) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
}

export function defaultLessonTitle(subjectName?: string | null) {
  return subjectName?.trim() ? `${subjectName} lesson` : "Lesson";
}

export type LessonHistoryView = {
  id: string;
  studentUserId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string | null;
  subjectSlug: string;
  subjectName: string | null;
  title: string;
  status: LessonHistoryStatus;
  statusLabel: string;
  startedAt: string;
  whenLabel: string;
  durationMinutes: number;
  attendedMinutes: number;
  notes: string;
};

export type LessonHistorySummary = {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  scheduledMinutes: number;
  attendedMinutes: number;
  rate: number;
  lastLessonAt: string | null;
};
