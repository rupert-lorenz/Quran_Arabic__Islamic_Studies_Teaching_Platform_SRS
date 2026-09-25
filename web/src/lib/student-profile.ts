export const STUDENT_SELF_REGISTER_MIN_AGE = 13;

export const studentLevels = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "hifdh", label: "Hifdh" },
  { value: "fluent", label: "Fluent / revision" },
] as const;

const levelValues = new Set(studentLevels.map((item) => item.value));

export function parseDateOfBirth(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const date = new Date(`${trimmed}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOfBirth(value?: Date | string | null) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function ageFromDateOfBirth(value: Date, now = new Date()) {
  let age = now.getUTCFullYear() - value.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - value.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && now.getUTCDate() < value.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function canSelfRegisterStudent(value: Date) {
  const age = ageFromDateOfBirth(value);
  return age >= STUDENT_SELF_REGISTER_MIN_AGE && age <= 120;
}

export function normalizeStudentLevel(value?: string | null) {
  const level = value?.trim().toLowerCase() ?? "";
  return levelValues.has(level as (typeof studentLevels)[number]["value"])
    ? level
    : null;
}

export function studentLevelLabel(value?: string | null) {
  return studentLevels.find((item) => item.value === value)?.label ?? null;
}

export function parseSubjectInterestList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function serializeSubjectInterestList(values: string[]) {
  return [...new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean))].join(
    ", ",
  );
}

export function studentProfileCompleteness(input: {
  dateOfBirth?: string | Date | null;
  currentLevel?: string | null;
  country?: string | null;
  subjectSlugs?: string[];
}) {
  const missing: string[] = [];
  if (!parseDateOfBirth(formatDateOfBirth(input.dateOfBirth ?? null))) {
    missing.push("Date of birth");
  }
  if (!normalizeStudentLevel(input.currentLevel)) {
    missing.push("Current level");
  }
  if (!input.country?.trim()) {
    missing.push("Country");
  }
  if (!input.subjectSlugs?.length) {
    missing.push("Subjects to learn");
  }
  return {
    ready: missing.length === 0,
    missing,
  };
}
