import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { lessonHistory, parentChildren, users } from "@/db/schema";
import {
  attendanceHref,
  familyChildAttendanceHref,
} from "@/lib/attendance";
import type {
  LessonHistorySummary,
  LessonHistoryView,
} from "@/lib/lesson-history";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { assertParentOwnsChild } from "@/server/parent/children";
import {
  getLessonHistoryState,
  listLessonsForTeacher,
  summarizeLessonHistory,
} from "@/server/student/lessons";

export type AttendanceLearner = {
  studentUserId: string;
  name: string;
  href: string;
  present: number;
  missed: number;
  rate: number;
  scheduledMinutes: number;
  attendedMinutes: number;
};

export type AttendanceProfile = {
  studentUserId: string;
  studentName: string;
  href: string;
  lessons: LessonHistoryView[];
  summary: LessonHistorySummary;
};

export type AttendanceDesk = {
  href: string;
  learners: AttendanceLearner[];
  profile: AttendanceProfile | null;
};

function isStaffAcademic(actor: ApiActor) {
  return hasAnyPermission(actor, [
    "academic.curriculum",
    "academic.certificates",
    "reports.academic",
    "classes.manage",
  ]);
}

function attendancePath(actor: ApiActor, studentUserId?: string) {
  return attendanceHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffAcademic(actor),
    studentUserId,
  );
}

async function namesFor(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((row) => [row.id, row.name ?? "Student"]));
}

async function listTeacherLearnerIds(teacherUserId: string) {
  const rows = await db
    .selectDistinct({ id: lessonHistory.studentUserId })
    .from(lessonHistory)
    .where(eq(lessonHistory.teacherUserId, teacherUserId));
  return rows.map((row) => row.id);
}

async function listLearnerIds(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    return children.map((child) => child.id);
  }
  if (actor.roleKey === "teacher" && !isStaffAcademic(actor)) {
    return (await listTeacherLearnerIds(actor.userId)).slice(0, 60);
  }
  if (isStaffAcademic(actor)) {
    const rows = await db
      .select({ id: lessonHistory.studentUserId })
      .from(lessonHistory)
      .groupBy(lessonHistory.studentUserId)
      .orderBy(desc(sql`max(${lessonHistory.startedAt})`))
      .limit(60);
    return rows.map((row) => row.id);
  }
  return [];
}

async function assertCanViewStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student" && actor.userId === studentUserId) return;
  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }
  if (isStaffAcademic(actor)) return;
  if (actor.roleKey === "teacher") {
    const known = await listTeacherLearnerIds(actor.userId);
    if (known.includes(studentUserId)) return;
    throw new ApiError(403, "FORBIDDEN", "You cannot view this attendance");
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view this attendance");
}

async function profileFor(
  actor: ApiActor,
  studentUserId: string,
  studentName: string,
  teacherLessons?: LessonHistoryView[],
): Promise<AttendanceProfile> {
  const lessons =
    teacherLessons?.filter((lesson) => lesson.studentUserId === studentUserId) ??
    (await getLessonHistoryState(studentUserId)).lessons;
  return {
    studentUserId,
    studentName,
    href:
      actor.roleKey === "parent"
        ? familyChildAttendanceHref(studentUserId)
        : attendancePath(actor, studentUserId),
    lessons,
    summary: summarizeLessonHistory(lessons),
  };
}

export async function getAttendanceDesk(
  actor: ApiActor,
  options?: { studentUserId?: string },
): Promise<AttendanceDesk> {
  const ids = await listLearnerIds(actor);
  const requested = options?.studentUserId;
  if (requested) await assertCanViewStudent(actor, requested);
  const selected =
    requested && ids.includes(requested)
      ? requested
      : actor.roleKey === "student"
        ? actor.userId
        : ids.length === 1
          ? ids[0]
          : requested && isStaffAcademic(actor)
            ? requested
            : undefined;
  if (selected && !ids.includes(selected)) ids.unshift(selected);
  const uniqueIds = [...new Set(ids)];
  const teacherLessons =
    actor.roleKey === "teacher" && !isStaffAcademic(actor)
      ? await listLessonsForTeacher(actor.userId)
      : undefined;
  const names = await namesFor(uniqueIds);
  const profiles = await Promise.all(
    uniqueIds.map((id) =>
      profileFor(actor, id, names.get(id) ?? "Student", teacherLessons),
    ),
  );
  const learners = profiles
    .map((profile) => ({
      studentUserId: profile.studentUserId,
      name: profile.studentName,
      href: profile.href,
      present: profile.summary.completed,
      missed: profile.summary.noShow,
      rate: profile.summary.rate,
      scheduledMinutes: profile.summary.scheduledMinutes,
      attendedMinutes: profile.summary.attendedMinutes,
    }))
    .sort(
      (left, right) =>
        right.rate - left.rate ||
        right.attendedMinutes - left.attendedMinutes ||
        left.name.localeCompare(right.name),
    );
  const profile =
    profiles.find((item) => item.studentUserId === selected) ?? null;
  return {
    href: attendancePath(actor, selected),
    learners,
    profile,
  };
}
