import { CLASSROOM_FILE_TYPES } from "./classroom-files";

export const HOMEWORK_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const HOMEWORK_MAX_FILES = 5;

export const HOMEWORK_STATUSES = ["draft", "assigned", "closed"] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];

export const HOMEWORK_WORK_STATUSES = [
  "assigned",
  "submitted",
  "marked",
] as const;
export type HomeworkWorkStatus = (typeof HOMEWORK_WORK_STATUSES)[number];

export const HOMEWORK_FILE_KINDS = ["brief", "submission", "feedback"] as const;
export type HomeworkFileKind = (typeof HOMEWORK_FILE_KINDS)[number];

export const HOMEWORK_FILE_TYPES = CLASSROOM_FILE_TYPES;

export function homeworkFileAccept() {
  return Object.keys(HOMEWORK_FILE_TYPES).join(",");
}

export function resolveHomeworkFileType(mime: string, name: string) {
  const lower = mime.toLowerCase().trim();
  if (HOMEWORK_FILE_TYPES[lower]) return lower;
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  for (const [type, exts] of Object.entries(HOMEWORK_FILE_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

export function homeworkHref(
  roleKey: string,
  isStaff: boolean,
  id?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/homework"
      : roleKey === "parent"
        ? "/family/homework"
        : roleKey === "teacher"
          ? "/teach/homework"
          : isStaff
            ? "/staff/academic/homework"
            : "/learn/homework";
  return id ? `${base}/${id}` : base;
}

export function homeworkFileHref(homeworkId: string, fileId: string) {
  return `/api/v1/homework/${homeworkId}/files/${fileId}`;
}

export function homeworkIsLate(
  dueAt?: string | Date | null,
  submittedAt?: string | Date | null,
) {
  if (!dueAt || !submittedAt) return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const submitted =
    submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  return submitted.getTime() > due.getTime();
}

export function homeworkDueStatus(dueAt?: string | Date | null) {
  if (!dueAt) return "none" as const;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "none" as const;
  return due.getTime() < Date.now() ? ("overdue" as const) : ("open" as const);
}
