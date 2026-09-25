import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  examSittings,
  exams,
  homeworkWork,
  homeworks,
  quizAttempts,
  quizzes,
  users,
} from "@/db/schema";
import { homeworkHref } from "@/lib/homework";
import { examsHref } from "@/lib/exams";
import { markingHref, type MarkingKind } from "@/lib/marking";
import { quizzesHref } from "@/lib/quizzes";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type MarkingItem = {
  kind: MarkingKind;
  id: string;
  parentId: string;
  title: string;
  studentName: string;
  href: string;
  submittedAt: string;
  pendingCount: number;
};

export type MarkingDesk = {
  href: string;
  items: MarkingItem[];
};

function isStaffCurriculum(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

async function canMark(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return true;
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

function staffish(actor: ApiActor) {
  return isStaffRole(actor.roleKey) || isStaffCurriculum(actor);
}

export async function listMarkingDesk(actor: ApiActor): Promise<MarkingDesk> {
  const href = markingHref(actor.roleKey, staffish(actor));
  if (!(await canMark(actor))) {
    return { href, items: [] };
  }
  const ownOnly = actor.roleKey === "teacher" && !isStaffCurriculum(actor);
  const quizFilter = [
    eq(quizAttempts.markingStatus, "pending"),
    ...(ownOnly ? [eq(quizzes.createdByUserId, actor.userId)] : []),
  ];
  const examFilter = [
    eq(examSittings.markingStatus, "pending"),
    ...(ownOnly ? [eq(exams.createdByUserId, actor.userId)] : []),
  ];
  const homeworkFilter = [
    eq(homeworkWork.status, "submitted"),
    ...(ownOnly ? [eq(homeworks.createdByUserId, actor.userId)] : []),
  ];

  const [quizRows, examRows, homeworkRows] = await Promise.all([
    db
      .select({
        id: quizAttempts.id,
        parentId: quizzes.id,
        title: quizzes.title,
        studentName: users.displayName,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .innerJoin(users, eq(users.id, quizAttempts.studentUserId))
      .where(and(...quizFilter))
      .orderBy(desc(quizAttempts.submittedAt))
      .limit(40),
    db
      .select({
        id: examSittings.id,
        parentId: exams.id,
        title: exams.title,
        studentName: users.displayName,
        submittedAt: examSittings.submittedAt,
        studentUserId: examSittings.studentUserId,
      })
      .from(examSittings)
      .innerJoin(exams, eq(exams.id, examSittings.examId))
      .innerJoin(users, eq(users.id, examSittings.studentUserId))
      .where(and(...examFilter))
      .orderBy(desc(examSittings.submittedAt))
      .limit(40),
    db
      .select({
        id: homeworkWork.id,
        parentId: homeworks.id,
        title: homeworks.title,
        studentName: users.displayName,
        submittedAt: homeworkWork.submittedAt,
      })
      .from(homeworkWork)
      .innerJoin(homeworks, eq(homeworks.id, homeworkWork.homeworkId))
      .innerJoin(users, eq(users.id, homeworkWork.studentUserId))
      .where(and(...homeworkFilter))
      .orderBy(desc(homeworkWork.submittedAt))
      .limit(40),
  ]);

  const staff = staffish(actor);
  const items: MarkingItem[] = [
    ...quizRows.map((row) => ({
      kind: "quiz" as const,
      id: row.id,
      parentId: row.parentId,
      title: row.title,
      studentName: row.studentName ?? "Student",
      href: quizzesHref(actor.roleKey, staff, row.parentId),
      submittedAt: row.submittedAt.toISOString(),
      pendingCount: 1,
    })),
    ...examRows.map((row) => ({
      kind: "exam" as const,
      id: row.id,
      parentId: row.parentId,
      title: row.title,
      studentName: row.studentName ?? "Student",
      href: examsHref(actor.roleKey, staff, row.parentId),
      submittedAt: row.submittedAt?.toISOString() ?? new Date().toISOString(),
      pendingCount: 1,
    })),
    ...homeworkRows.map((row) => ({
      kind: "homework" as const,
      id: row.id,
      parentId: row.parentId,
      title: row.title,
      studentName: row.studentName ?? "Student",
      href: homeworkHref(actor.roleKey, staff, row.parentId),
      submittedAt: row.submittedAt?.toISOString() ?? new Date().toISOString(),
      pendingCount: 1,
    })),
  ]
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
    .slice(0, 40);

  return { href, items };
}
