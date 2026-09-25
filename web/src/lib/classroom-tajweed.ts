import type { ClassroomWhiteboardStroke } from "@/db/schema/classrooms";

export const CLASSROOM_TAJWEED_RULES = [
  { id: "madd", color: "#be123c", mark: "مد", label: "classroom.tajweed_madd" },
  { id: "ghunnah", color: "#15803d", mark: "غنة", label: "classroom.tajweed_ghunnah" },
  { id: "ikhfa", color: "#65a30d", mark: "إخفاء", label: "classroom.tajweed_ikhfa" },
  { id: "idgham", color: "#c2410c", mark: "إدغام", label: "classroom.tajweed_idgham" },
  { id: "iqlab", color: "#1d4ed8", mark: "إقلاب", label: "classroom.tajweed_iqlab" },
  { id: "qalqalah", color: "#0369a1", mark: "قلقلة", label: "classroom.tajweed_qalqalah" },
  { id: "tafkheem", color: "#9a3412", mark: "تفخيم", label: "classroom.tajweed_tafkheem" },
  { id: "silent", color: "#6b7280", mark: "لا نطق", label: "classroom.tajweed_silent" },
] as const;

export type ClassroomTajweedRuleId = (typeof CLASSROOM_TAJWEED_RULES)[number]["id"];

export type ClassroomTajweedRule = (typeof CLASSROOM_TAJWEED_RULES)[number];

const RULES = new Map(CLASSROOM_TAJWEED_RULES.map((rule) => [rule.id, rule]));

export function classroomTajweedRule(
  value: string | undefined,
): ClassroomTajweedRule | undefined {
  return value ? RULES.get(value as ClassroomTajweedRuleId) : undefined;
}

export function classroomPageTajweedRules(strokes: ClassroomWhiteboardStroke[]) {
  const used = new Set(
    strokes
      .map((stroke) => classroomTajweedRule(stroke.rule)?.id)
      .filter((id): id is ClassroomTajweedRuleId => Boolean(id)),
  );
  return CLASSROOM_TAJWEED_RULES.filter((rule) => used.has(rule.id));
}

