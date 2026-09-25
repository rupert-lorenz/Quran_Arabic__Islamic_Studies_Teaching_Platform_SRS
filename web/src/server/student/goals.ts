import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { learningGoals, subjects } from "@/db/schema";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  defaultLearningGoalTitle,
  learningGoalKindLabel,
  learningGoalStatusLabel,
  MAX_LEARNING_GOALS,
  normalizeLearningGoalKind,
  normalizeLearningGoalStatus,
  type LearningGoalView,
} from "@/lib/learning-goals";
import { formatDateOfBirth, parseDateOfBirth } from "@/lib/student-profile";
import { assertParentOwnsChild } from "@/server/parent/children";
import {
  ensureStudentProfile,
  resolveSubjectInterests,
} from "@/server/student/profile";
import type {
  CreateLearningGoalInput,
  UpdateLearningGoalInput,
} from "./schemas";

export type { LearningGoalView };

async function assertCanManageGoals(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student") {
    if (actor.userId !== studentUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only manage your own goals");
    }
    return;
  }

  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }

  throw new ApiError(
    403,
    "FORBIDDEN",
    "Only students and parents can manage learning goals",
  );
}

async function resolveOptionalSubject(slug?: string | null) {
  const trimmed = slug?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const [subject] = await resolveSubjectInterests([trimmed]);
  return subject;
}

async function resolveOptionalTargetDate(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const date = parseDateOfBirth(trimmed);
  if (!date) {
    throw new ApiError(422, "VALIDATION", "Enter a valid target date");
  }
  return date;
}

function toLearningGoalView(
  row: {
    id: string;
    studentUserId: string;
    kind: string;
    title: string;
    detail: string | null;
    subjectSlug: string | null;
    subjectName: string | null;
    status: string;
    targetDate: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  },
): LearningGoalView {
  const kind = normalizeLearningGoalKind(row.kind) ?? "custom";
  const status = normalizeLearningGoalStatus(row.status) ?? "active";
  return {
    id: row.id,
    studentUserId: row.studentUserId,
    kind,
    kindLabel: learningGoalKindLabel(kind) ?? defaultLearningGoalTitle(kind),
    title: row.title,
    detail: row.detail ?? "",
    subjectSlug: row.subjectSlug ?? "",
    subjectName: row.subjectName,
    status,
    statusLabel: learningGoalStatusLabel(status) ?? "Active",
    targetDate: formatDateOfBirth(row.targetDate),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLearningGoals(studentUserId: string) {
  const rows = await db
    .select({
      id: learningGoals.id,
      studentUserId: learningGoals.studentUserId,
      kind: learningGoals.kind,
      title: learningGoals.title,
      detail: learningGoals.detail,
      subjectSlug: learningGoals.subjectSlug,
      subjectName: subjects.name,
      status: learningGoals.status,
      targetDate: learningGoals.targetDate,
      completedAt: learningGoals.completedAt,
      createdAt: learningGoals.createdAt,
      sortOrder: learningGoals.sortOrder,
    })
    .from(learningGoals)
    .leftJoin(subjects, eq(learningGoals.subjectSlug, subjects.slug))
    .where(eq(learningGoals.studentUserId, studentUserId))
    .orderBy(learningGoals.sortOrder, desc(learningGoals.createdAt));

  const rank = { active: 0, paused: 1, completed: 2 } as const;
  return rows
    .map(toLearningGoalView)
    .sort((a, b) => (rank[a.status as keyof typeof rank] ?? 9) - (rank[b.status as keyof typeof rank] ?? 9));
}

async function countLearningGoals(studentUserId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(learningGoals)
    .where(eq(learningGoals.studentUserId, studentUserId));
  return row?.value ?? 0;
}

async function getOwnedGoal(actor: ApiActor, studentUserId: string, goalId: string) {
  await assertCanManageGoals(actor, studentUserId);

  const [row] = await db
    .select()
    .from(learningGoals)
    .where(
      and(
        eq(learningGoals.id, goalId),
        eq(learningGoals.studentUserId, studentUserId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Learning goal not found");
  }

  return row;
}

export async function addLearningGoal(
  actor: ApiActor,
  studentUserId: string,
  input: CreateLearningGoalInput,
  ip: string,
) {
  await assertCanManageGoals(actor, studentUserId);
  await ensureStudentProfile(studentUserId);

  if ((await countLearningGoals(studentUserId)) >= MAX_LEARNING_GOALS) {
    throw new ApiError(
      422,
      "VALIDATION",
      `A learner can have up to ${MAX_LEARNING_GOALS} learning goals`,
    );
  }

  const title =
    input.title?.trim() || defaultLearningGoalTitle(input.kind);
  const [subjectSlug, targetDate] = await Promise.all([
    resolveOptionalSubject(input.subjectSlug),
    resolveOptionalTargetDate(input.targetDate),
  ]);

  const [created] = await db
    .insert(learningGoals)
    .values({
      studentUserId,
      kind: input.kind,
      title,
      detail: input.detail?.trim() || null,
      subjectSlug,
      targetDate,
      status: "active",
      createdByUserId: actor.userId,
    })
    .returning({ id: learningGoals.id });

  await writeAuditLog({
    actor,
    action: "students.goal_added",
    entityType: "learning_goal",
    entityId: created?.id ?? studentUserId,
    ipAddress: ip,
  });

  return { goals: await listLearningGoals(studentUserId) };
}

export async function updateLearningGoal(
  actor: ApiActor,
  studentUserId: string,
  goalId: string,
  input: UpdateLearningGoalInput,
  ip: string,
) {
  const existing = await getOwnedGoal(actor, studentUserId, goalId);
  const nextKind = input.kind ?? existing.kind;
  const nextTitle =
    input.title?.trim() ||
    (input.kind ? defaultLearningGoalTitle(input.kind) : existing.title);

  if (nextKind === "custom" && nextTitle.trim().length < 4) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Describe this custom goal in a few words",
    );
  }

  const nextStatus = input.status ?? existing.status;
  const subjectSlug =
    input.subjectSlug === undefined
      ? existing.subjectSlug
      : await resolveOptionalSubject(input.subjectSlug);
  const targetDate =
    input.targetDate === undefined
      ? existing.targetDate
      : await resolveOptionalTargetDate(input.targetDate);

  await db
    .update(learningGoals)
    .set({
      kind: nextKind,
      title: nextTitle,
      detail:
        input.detail === undefined
          ? existing.detail
          : input.detail.trim() || null,
      subjectSlug,
      targetDate,
      status: nextStatus,
      completedAt:
        nextStatus === "completed"
          ? existing.completedAt ?? new Date()
          : null,
    })
    .where(eq(learningGoals.id, existing.id));

  await writeAuditLog({
    actor,
    action: "students.goal_updated",
    entityType: "learning_goal",
    entityId: existing.id,
    ipAddress: ip,
  });

  return { goals: await listLearningGoals(studentUserId) };
}

export async function removeLearningGoal(
  actor: ApiActor,
  studentUserId: string,
  goalId: string,
  ip: string,
) {
  const existing = await getOwnedGoal(actor, studentUserId, goalId);
  await db.delete(learningGoals).where(eq(learningGoals.id, existing.id));
  await writeAuditLog({
    actor,
    action: "students.goal_removed",
    entityType: "learning_goal",
    entityId: existing.id,
    ipAddress: ip,
  });
  return { goals: await listLearningGoals(studentUserId) };
}
