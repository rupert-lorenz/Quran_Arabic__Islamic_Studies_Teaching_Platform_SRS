export const REPORT_KINDS = [
  "quiz",
  "exam",
  "homework",
  "game",
  "course",
  "lesson",
] as const;
export type StudentReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_ROW_LIMIT = 8;

export function reportsHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/reports"
      : roleKey === "parent"
        ? "/family/reports"
        : roleKey === "teacher"
          ? "/teach/reports"
          : isStaff
            ? "/staff/academic/reports"
            : "/learn/reports";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildReportsHref(studentUserId: string) {
  return `/family/children/${studentUserId}/reports`;
}
