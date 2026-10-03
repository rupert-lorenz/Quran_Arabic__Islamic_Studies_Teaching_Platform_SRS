export const SECURE_MESSAGE_CHANNELS = [
  "teacher_student",
  "teacher_parent",
  "teacher_admin",
  "family_admin",
] as const;

export type SecureMessageChannel = (typeof SECURE_MESSAGE_CHANNELS)[number];

export function isSecureMessageChannel(value: string): value is SecureMessageChannel {
  return (SECURE_MESSAGE_CHANNELS as readonly string[]).includes(value);
}

export function channelsForRole(roleKey: string): SecureMessageChannel[] {
  if (roleKey === "teacher") {
    return ["teacher_student", "teacher_parent", "teacher_admin"];
  }
  if (roleKey === "student") {
    return ["teacher_student", "family_admin"];
  }
  if (roleKey === "parent") {
    return ["teacher_parent", "family_admin"];
  }
  if (
    roleKey === "super_admin" ||
    roleKey === "admin" ||
    roleKey === "accounts" ||
    roleKey === "marketing" ||
    roleKey === "academic" ||
    roleKey === "safeguarding"
  ) {
    return ["teacher_admin", "family_admin"];
  }
  return [];
}

export function orderedPair(left: string, right: string) {
  return left < right ? ([left, right] as const) : ([right, left] as const);
}
