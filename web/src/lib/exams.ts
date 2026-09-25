import {
  emptyQuizPayload,
  parseQuizPayload,
  quizPayloadIsReady,
  type QuizPayload,
} from "@/lib/quizzes";

export const EXAM_STATUSES = ["draft", "published", "archived"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const EXAM_MAX_QUESTIONS = 40;
export const EXAM_MIN_DURATION = 5;
export const EXAM_MAX_DURATION = 180;
export const EXAM_WARN_SECONDS = 5 * 60;

export type ExamWindowStatus = "draft" | "scheduled" | "open" | "closed";

export function examsHref(roleKey: string, isStaff: boolean, id?: string) {
  const base =
    roleKey === "student"
      ? "/learn/exams"
      : roleKey === "parent"
        ? "/family/exams"
        : roleKey === "teacher"
          ? "/teach/exams"
          : isStaff
            ? "/staff/academic/exams"
            : "/learn/exams";
  return id ? `${base}/${id}` : base;
}

export function emptyExamPayload(): QuizPayload {
  return emptyQuizPayload();
}

export function parseExamPayload(raw: unknown): QuizPayload {
  return parseQuizPayload(raw, EXAM_MAX_QUESTIONS);
}

export function examPayloadIsReady(payload: QuizPayload) {
  return quizPayloadIsReady(payload);
}

export function parseExamDate(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function examWindowStatus(input: {
  status: ExamStatus;
  opensAt: Date | string | null;
  closesAt: Date | string | null;
  now?: Date;
}): ExamWindowStatus {
  if (input.status !== "published") return "draft";
  const now = input.now ?? new Date();
  const opens = input.opensAt ? new Date(input.opensAt) : null;
  const closes = input.closesAt ? new Date(input.closesAt) : null;
  if (!opens || !closes) return "draft";
  if (now < opens) return "scheduled";
  if (now > closes) return "closed";
  return "open";
}

export function examRemainingSeconds(dueAt: Date | string | null, now = new Date()) {
  if (!dueAt) return 0;
  return Math.max(0, Math.floor((new Date(dueAt).getTime() - now.getTime()) / 1000));
}

export function formatExamClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function examWasAutoSubmitted(
  submittedAt: Date | string | null,
  dueAt: Date | string,
) {
  if (!submittedAt) return false;
  return new Date(submittedAt).getTime() >= new Date(dueAt).getTime() - 1500;
}
