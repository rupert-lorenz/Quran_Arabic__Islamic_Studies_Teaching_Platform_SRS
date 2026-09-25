import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  fileObjects,
  files,
  groupLessonEnrollments,
  groupLessons,
  homeworkFiles,
  homeworkWork,
  homeworks,
  liveCourseEnrollments,
  liveCourses,
  parentChildren,
  studentProfiles,
  subjects,
  users,
} from "@/db/schema";
import {
  asciiDownloadName,
  sanitizeClassroomFileName,
} from "@/lib/classroom-files";
import {
  HOMEWORK_MAX_FILE_BYTES,
  HOMEWORK_MAX_FILES,
  homeworkFileHref,
  homeworkHref,
  homeworkIsLate,
  resolveHomeworkFileType,
  type HomeworkFileKind,
  type HomeworkStatus,
  type HomeworkWorkStatus,
} from "@/lib/homework";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { requireHumanSensitiveDecision } from "@/server/ai/human-decision";
import { ApiError } from "@/server/api/errors";
import { safeAwardGamification } from "@/server/lms/gamification";
import { findUserByEmail } from "@/server/staff/lookup";
import { getTeacherVerificationStatus } from "@/server/teacher/onboarding";

export type HomeworkFileView = {
  id: string;
  name: string;
  byteSize: number;
  href: string;
  kind: HomeworkFileKind;
};

export type HomeworkWorkView = {
  id: string;
  studentUserId: string;
  studentName: string;
  status: HomeworkWorkStatus;
  submissionText: string | null;
  submittedAt: string | null;
  isLate: boolean;
  markLabel: string | null;
  feedback: string | null;
  markedAt: string | null;
  files: HomeworkFileView[];
};

export type HomeworkView = {
  id: string;
  title: string;
  instructions: string | null;
  subjectSlug: string | null;
  subjectName: string | null;
  dueAt: string | null;
  status: HomeworkStatus;
  teacherName: string;
  assignedCount: number;
  submittedCount: number;
  markedCount: number;
  href: string;
  canManage: boolean;
  canSubmit: boolean;
  briefFiles: HomeworkFileView[];
  work: HomeworkWorkView[];
};

export type HomeworkDesk = {
  subjects: Array<{ slug: string; name: string }>;
  students: Array<{ userId: string; name: string }>;
  items: HomeworkView[];
};

function isStaffCurriculum(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

async function canCreateHomework(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return true;
  if (actor.roleKey !== "teacher") return false;
  const status = await getTeacherVerificationStatus(actor.userId);
  return status === "approved";
}

function homeworkPath(actor: ApiActor, id?: string) {
  return homeworkHref(
    actor.roleKey,
    isStaffRole(actor.roleKey) || isStaffCurriculum(actor),
    id,
  );
}

async function learnerIdsForActor(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => child.id);
}

async function requireStudentByEmail(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "No account matches that email");
  }
  const [student] = await db
    .select({ userId: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);
  if (!student) {
    throw new ApiError(422, "VALIDATION", "That account is not a student");
  }
  return { ...user, userId: student.userId };
}

function parseDueAt(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid deadline");
  }
  return date;
}

export async function listAssignableStudents(actor: ApiActor) {
  if (isStaffCurriculum(actor)) return [];
  if (actor.roleKey !== "teacher") return [];
  const [fromBookings, fromGroups, fromLive] = await Promise.all([
    db
      .selectDistinct({
        userId: bookings.studentUserId,
        name: users.displayName,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.studentUserId))
      .where(
        and(
          eq(bookings.teacherUserId, actor.userId),
          ne(bookings.status, "cancelled"),
        ),
      ),
    db
      .selectDistinct({
        userId: groupLessonEnrollments.studentUserId,
        name: users.displayName,
      })
      .from(groupLessonEnrollments)
      .innerJoin(
        groupLessons,
        eq(groupLessons.id, groupLessonEnrollments.groupLessonId),
      )
      .innerJoin(users, eq(users.id, groupLessonEnrollments.studentUserId))
      .where(
        and(
          eq(groupLessons.teacherUserId, actor.userId),
          ne(groupLessonEnrollments.status, "cancelled"),
        ),
      ),
    db
      .selectDistinct({
        userId: liveCourseEnrollments.studentUserId,
        name: users.displayName,
      })
      .from(liveCourseEnrollments)
      .innerJoin(
        liveCourses,
        eq(liveCourses.id, liveCourseEnrollments.liveCourseId),
      )
      .innerJoin(users, eq(users.id, liveCourseEnrollments.studentUserId))
      .where(
        and(
          eq(liveCourses.teacherUserId, actor.userId),
          ne(liveCourseEnrollments.status, "cancelled"),
        ),
      ),
  ]);
  const seen = new Map<string, string>();
  for (const row of [...fromBookings, ...fromGroups, ...fromLive]) {
    if (!seen.has(row.userId)) seen.set(row.userId, row.name ?? "Student");
  }
  return [...seen.entries()]
    .map(([userId, name]) => ({ userId, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function assertAssignableStudent(actor: ApiActor, studentUserId: string) {
  if (isStaffCurriculum(actor)) return;
  const students = await listAssignableStudents(actor);
  if (!students.some((row) => row.userId === studentUserId)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You can only assign homework to your own students",
    );
  }
}

async function loadHomeworkRow(id: string) {
  const [row] = await db
    .select({
      id: homeworks.id,
      title: homeworks.title,
      instructions: homeworks.instructions,
      subjectSlug: homeworks.subjectSlug,
      subjectName: subjects.name,
      dueAt: homeworks.dueAt,
      status: homeworks.status,
      createdByUserId: homeworks.createdByUserId,
      teacherName: users.displayName,
    })
    .from(homeworks)
    .leftJoin(subjects, eq(subjects.slug, homeworks.subjectSlug))
    .innerJoin(users, eq(users.id, homeworks.createdByUserId))
    .where(eq(homeworks.id, id))
    .limit(1);
  return row ?? null;
}

function canManageRow(
  actor: ApiActor,
  row: { createdByUserId: string },
) {
  return isStaffCurriculum(actor) || row.createdByUserId === actor.userId;
}

async function toHomeworkView(
  actor: ApiActor,
  row: NonNullable<Awaited<ReturnType<typeof loadHomeworkRow>>>,
): Promise<HomeworkView> {
  const learnerIds = await learnerIdsForActor(actor);
  const canManage = canManageRow(actor, row);
  const [workRows, fileRows] = await Promise.all([
    db
      .select({
        id: homeworkWork.id,
        studentUserId: homeworkWork.studentUserId,
        studentName: users.displayName,
        status: homeworkWork.status,
        submissionText: homeworkWork.submissionText,
        submittedAt: homeworkWork.submittedAt,
        markLabel: homeworkWork.markLabel,
        feedback: homeworkWork.feedback,
        markedAt: homeworkWork.markedAt,
      })
      .from(homeworkWork)
      .innerJoin(users, eq(users.id, homeworkWork.studentUserId))
      .where(eq(homeworkWork.homeworkId, row.id))
      .orderBy(users.displayName),
    db
      .select({
        id: homeworkFiles.id,
        workId: homeworkFiles.workId,
        kind: homeworkFiles.kind,
        fileId: files.id,
        name: files.originalName,
        byteSize: files.byteSize,
      })
      .from(homeworkFiles)
      .innerJoin(files, eq(files.id, homeworkFiles.fileId))
      .where(eq(homeworkFiles.homeworkId, row.id)),
  ]);

  const visibleWork = canManage
    ? workRows
    : workRows.filter((item) => learnerIds.includes(item.studentUserId));
  const workIds = new Set(visibleWork.map((item) => item.id));

  const toFile = (item: (typeof fileRows)[number]): HomeworkFileView => ({
    id: item.fileId,
    name: item.name ?? "file",
    byteSize: item.byteSize,
    href: homeworkFileHref(row.id, item.fileId),
    kind: item.kind,
  });

  const work: HomeworkWorkView[] = visibleWork.map((item) => ({
    id: item.id,
    studentUserId: item.studentUserId,
    studentName: item.studentName ?? "Student",
    status: item.status,
    submissionText: item.submissionText,
    submittedAt: item.submittedAt?.toISOString() ?? null,
    isLate: homeworkIsLate(row.dueAt, item.submittedAt),
    markLabel: item.markLabel,
    feedback: item.feedback,
    markedAt: item.markedAt?.toISOString() ?? null,
    files: fileRows
      .filter((file) => file.workId === item.id && workIds.has(item.id))
      .map(toFile),
  }));

  const canSubmit =
    row.status !== "closed" &&
    actor.roleKey === "student" &&
    work.some((item) => item.studentUserId === actor.userId);

  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    subjectSlug: row.subjectSlug,
    subjectName: row.subjectName,
    dueAt: row.dueAt?.toISOString() ?? null,
    status: row.status,
    teacherName: row.teacherName ?? "Teacher",
    assignedCount: workRows.length,
    submittedCount: workRows.filter((item) => item.submittedAt).length,
    markedCount: workRows.filter((item) => item.status === "marked").length,
    href: homeworkPath(actor, row.id),
    canManage,
    canSubmit,
    briefFiles: fileRows.filter((file) => file.kind === "brief").map(toFile),
    work,
  };
}

export async function listHomework(actor: ApiActor): Promise<HomeworkView[]> {
  const learnerIds = await learnerIdsForActor(actor);
  const canManageAll = isStaffCurriculum(actor);
  const rows = canManageAll
    ? await db
        .select({
          id: homeworks.id,
          title: homeworks.title,
          instructions: homeworks.instructions,
          subjectSlug: homeworks.subjectSlug,
          subjectName: subjects.name,
          dueAt: homeworks.dueAt,
          status: homeworks.status,
          createdByUserId: homeworks.createdByUserId,
          teacherName: users.displayName,
        })
        .from(homeworks)
        .leftJoin(subjects, eq(subjects.slug, homeworks.subjectSlug))
        .innerJoin(users, eq(users.id, homeworks.createdByUserId))
        .orderBy(desc(homeworks.createdAt))
        .limit(80)
    : actor.roleKey === "teacher"
      ? await db
          .select({
            id: homeworks.id,
            title: homeworks.title,
            instructions: homeworks.instructions,
            subjectSlug: homeworks.subjectSlug,
            subjectName: subjects.name,
            dueAt: homeworks.dueAt,
            status: homeworks.status,
            createdByUserId: homeworks.createdByUserId,
            teacherName: users.displayName,
          })
          .from(homeworks)
          .leftJoin(subjects, eq(subjects.slug, homeworks.subjectSlug))
          .innerJoin(users, eq(users.id, homeworks.createdByUserId))
          .where(eq(homeworks.createdByUserId, actor.userId))
          .orderBy(desc(homeworks.createdAt))
          .limit(80)
      : learnerIds.length
        ? await db
            .select({
              id: homeworks.id,
              title: homeworks.title,
              instructions: homeworks.instructions,
              subjectSlug: homeworks.subjectSlug,
              subjectName: subjects.name,
              dueAt: homeworks.dueAt,
              status: homeworks.status,
              createdByUserId: homeworks.createdByUserId,
              teacherName: users.displayName,
            })
            .from(homeworks)
            .innerJoin(homeworkWork, eq(homeworkWork.homeworkId, homeworks.id))
            .leftJoin(subjects, eq(subjects.slug, homeworks.subjectSlug))
            .innerJoin(users, eq(users.id, homeworks.createdByUserId))
            .where(
              and(
                inArray(homeworkWork.studentUserId, learnerIds),
                ne(homeworks.status, "draft"),
              ),
            )
            .orderBy(desc(homeworks.createdAt))
            .limit(80)
        : [];

  const unique = new Map(rows.map((row) => [row.id, row]));
  return Promise.all(
    [...unique.values()].map((row) => toHomeworkView(actor, row)),
  );
}

export async function getHomework(actor: ApiActor, id: string) {
  const row = await loadHomeworkRow(id);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Homework not found");
  }
  const view = await toHomeworkView(actor, row);
  if (!view.canManage && !view.work.length && row.status === "draft") {
    throw new ApiError(404, "NOT_FOUND", "Homework not found");
  }
  if (!view.canManage && !view.work.length) {
    throw new ApiError(404, "NOT_FOUND", "Homework not found");
  }
  return view;
}

export async function listHomeworkDesk(actor: ApiActor): Promise<HomeworkDesk> {
  if (!(await canCreateHomework(actor))) {
    return {
      subjects: [],
      students: [],
      items: await listHomework(actor),
    };
  }
  const [subjectRows, students, items] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    listAssignableStudents(actor),
    listHomework(actor),
  ]);
  return { subjects: subjectRows, students, items };
}

export async function createHomework(
  actor: ApiActor,
  input: {
    title: string;
    instructions?: string;
    subjectSlug?: string;
    dueAt?: string;
  },
  ip: string,
) {
  if (!(await canCreateHomework(actor))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot create homework");
  }
  const title = input.title.trim();
  if (title.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a title for this homework");
  }
  const subjectSlug = input.subjectSlug?.trim() || null;
  if (subjectSlug) {
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);
    if (!subject) {
      throw new ApiError(404, "NOT_FOUND", "Subject not found");
    }
  }
  const [created] = await db
    .insert(homeworks)
    .values({
      title,
      instructions: input.instructions?.trim() || null,
      subjectSlug,
      dueAt: parseDueAt(input.dueAt),
      createdByUserId: actor.userId,
    })
    .returning({ id: homeworks.id });
  await writeAuditLog({
    actor,
    action: "homework.created",
    entityType: "homework",
    entityId: created?.id ?? title,
    ipAddress: ip,
  });
  return listHomeworkDesk(actor);
}

export async function setHomeworkStatus(
  actor: ApiActor,
  input: { homeworkId: string; status: HomeworkStatus },
  ip: string,
) {
  const row = await loadHomeworkRow(input.homeworkId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Homework not found");
  if (!canManageRow(actor, row)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot update this homework");
  }
  await db
    .update(homeworks)
    .set({ status: input.status })
    .where(eq(homeworks.id, input.homeworkId));
  await writeAuditLog({
    actor,
    action: "homework.status_set",
    entityType: "homework",
    entityId: input.homeworkId,
    ipAddress: ip,
    metadata: { status: input.status },
  });
  return getHomework(actor, input.homeworkId);
}

export async function assignHomework(
  actor: ApiActor,
  input: { homeworkId: string; studentUserId?: string; email?: string },
  ip: string,
) {
  const row = await loadHomeworkRow(input.homeworkId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Homework not found");
  if (!canManageRow(actor, row)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot assign this homework");
  }
  const studentUserId = input.studentUserId
    ? input.studentUserId
    : input.email
      ? (await requireStudentByEmail(input.email)).userId
      : null;
  if (!studentUserId) {
    throw new ApiError(422, "VALIDATION", "Choose a student or enter their email");
  }
  await assertAssignableStudent(actor, studentUserId);
  try {
    await db.insert(homeworkWork).values({
      homeworkId: input.homeworkId,
      studentUserId,
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That student already has this homework");
  }
  if (row.status === "draft") {
    await db
      .update(homeworks)
      .set({ status: "assigned" })
      .where(eq(homeworks.id, input.homeworkId));
  }
  await writeAuditLog({
    actor,
    action: "homework.assigned",
    entityType: "homework",
    entityId: input.homeworkId,
    ipAddress: ip,
    metadata: { studentUserId },
  });
  return getHomework(actor, input.homeworkId);
}

export async function submitHomework(
  actor: ApiActor,
  input: { homeworkId: string; text?: string },
  ip: string,
) {
  if (actor.roleKey !== "student") {
    throw new ApiError(403, "FORBIDDEN", "Only students can submit homework");
  }
  const row = await loadHomeworkRow(input.homeworkId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Homework not found");
  if (row.status === "closed") {
    throw new ApiError(422, "VALIDATION", "This homework is closed");
  }
  const [work] = await db
    .select({
      id: homeworkWork.id,
      status: homeworkWork.status,
    })
    .from(homeworkWork)
    .where(
      and(
        eq(homeworkWork.homeworkId, input.homeworkId),
        eq(homeworkWork.studentUserId, actor.userId),
      ),
    )
    .limit(1);
  if (!work) {
    throw new ApiError(404, "NOT_FOUND", "This homework was not assigned to you");
  }
  await db
    .update(homeworkWork)
    .set({
      status: work.status === "marked" ? "marked" : "submitted",
      submissionText: input.text?.trim() || null,
      submittedAt: new Date(),
    })
    .where(eq(homeworkWork.id, work.id));
  await writeAuditLog({
    actor,
    action: "homework.submitted",
    entityType: "homework",
    entityId: input.homeworkId,
    ipAddress: ip,
  });
  return getHomework(actor, input.homeworkId);
}

export async function markHomework(
  actor: ApiActor,
  input: {
    homeworkId: string;
    studentUserId: string;
    markLabel?: string;
    feedback?: string;
  },
  ip: string,
) {
  requireHumanSensitiveDecision();
  const row = await loadHomeworkRow(input.homeworkId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Homework not found");
  if (!canManageRow(actor, row)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot mark this homework");
  }
  const markLabel = input.markLabel?.trim() || null;
  const feedback = input.feedback?.trim() || null;
  if (!markLabel && !feedback) {
    throw new ApiError(422, "VALIDATION", "Enter a mark or feedback");
  }
  const [updated] = await db
    .update(homeworkWork)
    .set({
      status: "marked",
      markLabel,
      feedback,
      markedAt: new Date(),
      markedByUserId: actor.userId,
    })
    .where(
      and(
        eq(homeworkWork.homeworkId, input.homeworkId),
        eq(homeworkWork.studentUserId, input.studentUserId),
      ),
    )
    .returning({ id: homeworkWork.id });
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "That student was not assigned this homework");
  }
  await writeAuditLog({
    actor,
    action: "homework.marked",
    entityType: "homework",
    entityId: input.homeworkId,
    ipAddress: ip,
    metadata: { studentUserId: input.studentUserId },
  });
  await safeAwardGamification({
    kind: "homework",
    studentUserId: input.studentUserId,
    sourceId: input.homeworkId,
    title: row.title,
  });
  return getHomework(actor, input.homeworkId);
}

async function countHomeworkFiles(
  homeworkId: string,
  kind: HomeworkFileKind,
  workId?: string | null,
) {
  const rows = await db
    .select({ id: homeworkFiles.id })
    .from(homeworkFiles)
    .where(
      workId
        ? and(
            eq(homeworkFiles.homeworkId, homeworkId),
            eq(homeworkFiles.kind, kind),
            eq(homeworkFiles.workId, workId),
          )
        : and(
            eq(homeworkFiles.homeworkId, homeworkId),
            eq(homeworkFiles.kind, kind),
          ),
    );
  return rows.length;
}

export async function uploadHomeworkFile(
  actor: ApiActor,
  input: {
    homeworkId: string;
    kind: HomeworkFileKind;
    studentUserId?: string;
    name: string;
    mimeType: string;
    bytes: Buffer;
  },
  ip: string,
) {
  const row = await loadHomeworkRow(input.homeworkId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Homework not found");
  const mime = resolveHomeworkFileType(input.mimeType, input.name);
  if (!mime) {
    throw new ApiError(422, "VALIDATION", "That file type cannot be attached");
  }
  if (input.bytes.byteLength > HOMEWORK_MAX_FILE_BYTES) {
    throw new ApiError(422, "VALIDATION", "That file is larger than 8 MB");
  }

  let workId: string | null = null;
  if (input.kind === "brief") {
    if (!canManageRow(actor, row)) {
      throw new ApiError(403, "FORBIDDEN", "You cannot attach files to this homework");
    }
  } else if (input.kind === "submission") {
    if (actor.roleKey !== "student") {
      throw new ApiError(403, "FORBIDDEN", "Only students can attach a submission");
    }
    const [work] = await db
      .select({ id: homeworkWork.id })
      .from(homeworkWork)
      .where(
        and(
          eq(homeworkWork.homeworkId, input.homeworkId),
          eq(homeworkWork.studentUserId, actor.userId),
        ),
      )
      .limit(1);
    if (!work) {
      throw new ApiError(404, "NOT_FOUND", "This homework was not assigned to you");
    }
    if (row.status === "closed") {
      throw new ApiError(422, "VALIDATION", "This homework is closed");
    }
    workId = work.id;
  } else {
    if (!canManageRow(actor, row)) {
      throw new ApiError(403, "FORBIDDEN", "You cannot attach feedback files");
    }
    if (!input.studentUserId) {
      throw new ApiError(422, "VALIDATION", "Choose the student for this feedback file");
    }
    const [work] = await db
      .select({ id: homeworkWork.id })
      .from(homeworkWork)
      .where(
        and(
          eq(homeworkWork.homeworkId, input.homeworkId),
          eq(homeworkWork.studentUserId, input.studentUserId),
        ),
      )
      .limit(1);
    if (!work) {
      throw new ApiError(404, "NOT_FOUND", "That student was not assigned this homework");
    }
    workId = work.id;
  }

  const existing = await countHomeworkFiles(input.homeworkId, input.kind, workId);
  if (existing >= HOMEWORK_MAX_FILES) {
    throw new ApiError(422, "VALIDATION", "This homework already has the maximum files");
  }

  const fileId = randomUUID();
  const name = sanitizeClassroomFileName(input.name);
  await db.insert(files).values({
    id: fileId,
    ownerUserId: actor.userId,
    purpose: "homework",
    storageKey: `homework:${input.homeworkId}:${fileId}:${name}`,
    mimeType: mime,
    byteSize: input.bytes.byteLength,
    originalName: name,
    visibility: "restricted",
  });
  await db.insert(fileObjects).values({
    fileId,
    content: input.bytes,
  });
  await db.insert(homeworkFiles).values({
    homeworkId: input.homeworkId,
    workId,
    fileId,
    kind: input.kind,
    uploadedByUserId: actor.userId,
  });
  await writeAuditLog({
    actor,
    action: "homework.file_added",
    entityType: "homework",
    entityId: input.homeworkId,
    ipAddress: ip,
    metadata: { kind: input.kind, fileId },
  });
  return getHomework(actor, input.homeworkId);
}

export async function downloadHomeworkFile(
  actor: ApiActor,
  homeworkId: string,
  fileId: string,
) {
  await getHomework(actor, homeworkId);
  const [row] = await db
    .select({
      homeworkId: homeworkFiles.homeworkId,
      mimeType: files.mimeType,
      originalName: files.originalName,
      content: fileObjects.content,
    })
    .from(homeworkFiles)
    .innerJoin(files, eq(files.id, homeworkFiles.fileId))
    .innerJoin(fileObjects, eq(fileObjects.fileId, files.id))
    .where(
      and(eq(homeworkFiles.homeworkId, homeworkId), eq(files.id, fileId)),
    )
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "That file is no longer stored");
  }
  const name = row.originalName?.trim() || "file";
  const encoded = encodeURIComponent(name);
  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.content.byteLength),
      "Content-Disposition": `attachment; filename="${asciiDownloadName(name)}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
