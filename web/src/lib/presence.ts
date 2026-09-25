export const PRESENCE_KINDS = [
  "login",
  "logout",
  "lesson_enter",
  "lesson_exit",
] as const;
export type PresenceKind = (typeof PRESENCE_KINDS)[number];

export function isPresenceKind(value: string): value is PresenceKind {
  return (PRESENCE_KINDS as readonly string[]).includes(value);
}

export function presenceHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/activity"
      : roleKey === "parent"
        ? "/family/activity"
        : roleKey === "teacher"
          ? "/teach/activity"
          : isStaff
            ? "/staff/academic/activity"
            : "/learn/activity";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function familyChildPresenceHref(studentUserId: string) {
  return `/family/children/${studentUserId}/activity`;
}

export function summarizePresence(kinds: string[]) {
  return {
    logins: kinds.filter((kind) => kind === "login").length,
    logouts: kinds.filter((kind) => kind === "logout").length,
    enters: kinds.filter((kind) => kind === "lesson_enter").length,
    exits: kinds.filter((kind) => kind === "lesson_exit").length,
  };
}
