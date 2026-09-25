import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  lessonHistory,
  roles,
  subjects,
  teacherProfiles,
  users,
} from "@/db/schema";
import { attendanceRate, clampLessonMinutes } from "@/lib/attendance";
import {
  DEFAULT_LESSON_DURATION_MINUTES,
  defaultLessonTitle,
  formatLessonWhen,
  LESSON_HISTORY_PAGE_SIZE,
  lessonHistoryStatusLabel,
  normalizeLessonHistoryStatus,
  parseLessonStartedAt,
  type LessonHistorySummary,
  type LessonHistoryView,
} from "@/lib/lesson-history";
import { hasAnyPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import { safeAwardGamification } from "@/server/lms/gamification";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { normalizeEmail } from "@/server/auth/password";
import { assertParentOwnsChild } from "@/server/parent/children";
import {
  ensureStudentProfile,
  resolveSubjectInterests,
} from "@/server/student/profile";
import type { RecordLessonInput } from "./schemas";

type LessonRow = {
  id: string;
  studentUserId: string;
  studentName: string;
  teacherUserId: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  title: string;
  status: string;
  startedAt: Date;
  durationMinutes: number;
  attendedMinutes: number | null;
  notes: string | null;
};

export async function assertCanViewLessonHistory(
  actor: ApiActor,
  studentUserId: string,
) {
  if (actor.roleKey === "student" && actor.userId === studentUserId) {
    return;
  }
  if (actor.roleKey === "parent") {
    await assertParentOwnsChild(actor.userId, studentUserId);
    return;
  }
  if (hasAnyPermission(actor, ["classes.manage", "students.manage"])) {
    return;
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view this lesson history");
}

async function findRoleUser(input: {
  userId?: string;
  email?: string;
  roleKey: "student" | "teacher";
  missing: string;
}) {
  const email = input.email ? normalizeEmail(input.email) : "";
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        input.userId ? eq(users.id, input.userId) : eq(users.email, email),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!row || row.roleKey !== input.roleKey) {
    throw new ApiError(404, "NOT_FOUND", input.missing);
  }

  return row;
}

async function teacherNamesById(ids: string[]) {
  const names = new Map<string, string>();
  if (!ids.length) {
    return names;
  }
  const teachers = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  for (const teacher of teachers) {
    names.set(teacher.id, teacher.displayName);
  }
  return names;
}

function toLessonView(
  row: LessonRow,
  teacherNames: Map<string, string>,
): LessonHistoryView {
  const status = normalizeLessonHistoryStatus(row.status) ?? "completed";
  return {
    id: row.id,
    studentUserId: row.studentUserId,
    studentName: row.studentName,
    teacherUserId: row.teacherUserId ?? "",
    teacherName: row.teacherUserId
      ? teacherNames.get(row.teacherUserId) ?? null
      : null,
    subjectSlug: row.subjectSlug ?? "",
    subjectName: row.subjectName,
    title: row.title,
    status,
    statusLabel: lessonHistoryStatusLabel(status) ?? "Completed",
    startedAt: row.startedAt.toISOString(),
    whenLabel: formatLessonWhen(row.startedAt),
    durationMinutes: row.durationMinutes,
    attendedMinutes:
      row.attendedMinutes ??
      (status === "completed" ? row.durationMinutes : 0),
    notes: row.notes ?? "",
  };
}

export function summarizeLessonHistory(
  lessons: LessonHistoryView[],
): LessonHistorySummary {
  const completed = lessons.filter((item) => item.status === "completed");
  const cancelled = lessons.filter((item) => item.status === "cancelled");
  const noShow = lessons.filter((item) => item.status === "no_show");
  const counted = [...completed, ...noShow];
  return {
    total: lessons.length,
    completed: completed.length,
    cancelled: cancelled.length,
    noShow: noShow.length,
    scheduledMinutes: counted.reduce((sum, item) => sum + item.durationMinutes, 0),
    attendedMinutes: counted.reduce((sum, item) => sum + item.attendedMinutes, 0),
    rate: attendanceRate(completed.length, noShow.length),
    lastLessonAt: lessons[0]?.startedAt ?? null,
  };
}

async function mapLessonRows(rows: LessonRow[]) {
  const teacherNames = await teacherNamesById([
    ...new Set(
      rows
        .map((row) => row.teacherUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]);
  return rows.map((row) => toLessonView(row, teacherNames));
}

const lessonSelect = {
  id: lessonHistory.id,
  studentUserId: lessonHistory.studentUserId,
  studentName: users.displayName,
  teacherUserId: lessonHistory.teacherUserId,
  subjectSlug: lessonHistory.subjectSlug,
  subjectName: subjects.name,
  title: lessonHistory.title,
  status: lessonHistory.status,
  startedAt: lessonHistory.startedAt,
  durationMinutes: lessonHistory.durationMinutes,
  attendedMinutes: lessonHistory.attendedMinutes,
  notes: lessonHistory.notes,
};

export async function listLessonHistory(
  studentUserId: string,
  limit = LESSON_HISTORY_PAGE_SIZE,
) {
  const rows = await db
    .select(lessonSelect)
    .from(lessonHistory)
    .innerJoin(users, eq(lessonHistory.studentUserId, users.id))
    .leftJoin(subjects, eq(lessonHistory.subjectSlug, subjects.slug))
    .where(eq(lessonHistory.studentUserId, studentUserId))
    .orderBy(desc(lessonHistory.startedAt))
    .limit(limit);

  return mapLessonRows(rows);
}

export async function getLessonHistoryState(studentUserId: string) {
  const lessons = await listLessonHistory(studentUserId);
  return {
    lessons,
    summary: summarizeLessonHistory(lessons),
  };
}

export async function listLessonsForTeacher(
  teacherUserId: string,
  limit = LESSON_HISTORY_PAGE_SIZE,
) {
  const rows = await db
    .select(lessonSelect)
    .from(lessonHistory)
    .innerJoin(users, eq(lessonHistory.studentUserId, users.id))
    .leftJoin(subjects, eq(lessonHistory.subjectSlug, subjects.slug))
    .where(eq(lessonHistory.teacherUserId, teacherUserId))
    .orderBy(desc(lessonHistory.startedAt))
    .limit(limit);

  return mapLessonRows(rows);
}

export async function getTeacherLessonHistoryState(teacherUserId: string) {
  const lessons = await listLessonsForTeacher(teacherUserId);
  return {
    lessons,
    summary: summarizeLessonHistory(lessons),
  };
}

export async function listRecentLessonHistory(
  limit = LESSON_HISTORY_PAGE_SIZE,
) {
  const rows = await db
    .select(lessonSelect)
    .from(lessonHistory)
    .innerJoin(users, eq(lessonHistory.studentUserId, users.id))
    .leftJoin(subjects, eq(lessonHistory.subjectSlug, subjects.slug))
    .orderBy(desc(lessonHistory.startedAt))
    .limit(limit);

  const lessons = await mapLessonRows(rows);
  return {
    lessons,
    summary: summarizeLessonHistory(lessons),
  };
}

export async function resolveStudentUserId(input: {
  studentUserId?: string;
  studentEmail?: string;
}) {
  if (input.studentUserId) {
    const student = await findRoleUser({
      userId: input.studentUserId,
      roleKey: "student",
      missing: "Student account not found",
    });
    return student.id;
  }
  if (input.studentEmail) {
    const student = await findRoleUser({
      email: input.studentEmail,
      roleKey: "student",
      missing: "Student account not found",
    });
    return student.id;
  }
  return null;
}

export async function recordLesson(
  actor: ApiActor,
  input: RecordLessonInput,
  ip: string,
) {
  if (!hasAnyPermission(actor, ["classes.manage", "students.manage"])) {
    throw new ApiError(403, "FORBIDDEN", "You cannot record lesson history");
  }

  const student = await findRoleUser({
    userId: input.studentUserId,
    email: input.studentEmail,
    roleKey: "student",
    missing: "Student account not found",
  });
  await ensureStudentProfile(student.id);

  const teacher =
    input.teacherEmail || input.teacherUserId
      ? await findRoleUser({
          userId: input.teacherUserId,
          email: input.teacherEmail,
          roleKey: "teacher",
          missing: "Teacher account not found",
        })
      : null;

  if (teacher) {
    const [profile] = await db
      .select({ userId: teacherProfiles.userId })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, teacher.id))
      .limit(1);
    if (!profile) {
      throw new ApiError(
        422,
        "VALIDATION",
        "That teacher has no teacher profile",
      );
    }
  }

  const startedAt = parseLessonStartedAt(input.startedAt);
  if (!startedAt) {
    throw new ApiError(422, "VALIDATION", "Enter a valid lesson date and time");
  }

  const subjectSlug = input.subjectSlug?.trim()
    ? (await resolveSubjectInterests([input.subjectSlug]))[0]
    : null;
  const [subject] = subjectSlug
    ? await db
        .select({ name: subjects.name })
        .from(subjects)
        .where(eq(subjects.slug, subjectSlug))
        .limit(1)
    : [];

  const [created] = await db
    .insert(lessonHistory)
    .values({
      studentUserId: student.id,
      teacherUserId: teacher?.id ?? null,
      subjectSlug,
      title: input.title?.trim() || defaultLessonTitle(subject?.name),
      status: input.status,
      startedAt,
      durationMinutes: input.durationMinutes ?? DEFAULT_LESSON_DURATION_MINUTES,
      attendedMinutes:
        input.status === "completed"
          ? clampLessonMinutes(
              input.attendedMinutes ??
                input.durationMinutes ??
                DEFAULT_LESSON_DURATION_MINUTES,
            )
          : 0,
      notes: input.notes?.trim() || null,
      recordedByUserId: actor.userId,
    })
    .returning({ id: lessonHistory.id });

  await writeAuditLog({
    actor,
    action: "students.lesson_recorded",
    entityType: "lesson_history",
    entityId: created?.id ?? student.id,
    ipAddress: ip,
  });
  if (created && input.status === "completed") {
    await safeAwardGamification({
      kind: "lesson",
      studentUserId: student.id,
      sourceId: created.id,
      title: input.title?.trim() || defaultLessonTitle(subject?.name),
    });
  }

  return getLessonHistoryState(student.id);
}
