export const MARKING_KINDS = ["quiz", "exam", "homework"] as const;
export type MarkingKind = (typeof MARKING_KINDS)[number];

export function markingHref(roleKey: string, isStaff: boolean) {
  if (roleKey === "teacher") return "/teach/marking";
  if (isStaff) return "/staff/academic";
  return "/teach/marking";
}
