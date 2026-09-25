export function attendanceHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/attendance"
      : roleKey === "parent"
        ? "/family/attendance"
        : roleKey === "teacher"
          ? "/teach/attendance"
          : isStaff
            ? "/staff/academic/attendance"
            : "/learn/attendance";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildAttendanceHref(studentUserId: string) {
  return `/family/children/${studentUserId}/attendance`;
}

export function attendanceRate(present: number, missed: number) {
  const taken = Math.max(0, present) + Math.max(0, missed);
  if (!taken) return 0;
  return Math.round((Math.max(0, present) / taken) * 100);
}

export function clampLessonMinutes(value: number) {
  return Math.max(0, Math.round(value));
}
