export const MAX_LEARNING_GOALS = 12;

export const learningGoalKinds = [
  { value: "fluency", label: "Recite fluently" },
  { value: "hifdh", label: "Memorise (Hifdh)" },
  { value: "tajweed", label: "Improve Tajweed" },
  { value: "arabic", label: "Learn Arabic" },
  { value: "islamic_studies", label: "Islamic Studies" },
  { value: "exam", label: "School or exam support" },
  { value: "custom", label: "Something else" },
] as const;

export const learningGoalStatuses = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const;

export type LearningGoalKind = (typeof learningGoalKinds)[number]["value"];
export type LearningGoalStatus = (typeof learningGoalStatuses)[number]["value"];

const kindValues = new Set(learningGoalKinds.map((item) => item.value));
const statusValues = new Set(learningGoalStatuses.map((item) => item.value));

export function normalizeLearningGoalKind(value?: string | null) {
  const kind = value?.trim().toLowerCase() ?? "";
  return kindValues.has(kind as LearningGoalKind) ? (kind as LearningGoalKind) : null;
}

export function learningGoalKindLabel(value?: string | null) {
  return learningGoalKinds.find((item) => item.value === value)?.label ?? null;
}

export function defaultLearningGoalTitle(kind?: string | null) {
  return learningGoalKindLabel(kind) ?? "Learning goal";
}

export function normalizeLearningGoalStatus(value?: string | null) {
  const status = value?.trim().toLowerCase() ?? "";
  return statusValues.has(status as LearningGoalStatus)
    ? (status as LearningGoalStatus)
    : null;
}

export function learningGoalStatusLabel(value?: string | null) {
  return learningGoalStatuses.find((item) => item.value === value)?.label ?? null;
}

export type LearningGoalView = {
  id: string;
  studentUserId: string;
  kind: string;
  kindLabel: string;
  title: string;
  detail: string;
  subjectSlug: string;
  subjectName: string | null;
  status: string;
  statusLabel: string;
  targetDate: string;
  completedAt: string | null;
  createdAt: string;
};
