import { and, desc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  classrooms,
  fileObjects,
  files,
  groupLessonEnrollments,
  groupLessons,
  parentChildren,
  platformSettings,
  recordings,
} from "@/db/schema";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { openSecureRecordingBytes } from "@/server/classroom/recording-storage";

export const RECORDING_RETENTION_SETTING = "recording.retention_days";
export const RECORDING_RETENTION_MIN_DAYS = 1;
export const RECORDING_RETENTION_MAX_DAYS = 3650;
export const RECORDING_RETENTION_DEFAULT_DAYS = 365;

export type ClassroomRecordingAccessView = {
  id: string;
  classroomId: string;
  title: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  expiresAt: string | null;
  retained: boolean;
  href: string;
  canRetain: boolean;
};

function canReviewRecordings(actor: ApiActor) {
  return (
    isStaffRole(actor.roleKey) &&
    hasAnyPermission(actor, "safeguarding.recordings")
  );
}

function canEditRetention(actor: ApiActor) {
  return (
    isStaffRole(actor.roleKey) &&
    hasAnyPermission(actor, ["safeguarding.recordings", "settings.write"])
  );
}

function asDays(value: unknown) {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days)) return RECORDING_RETENTION_DEFAULT_DAYS;
  return Math.min(
    RECORDING_RETENTION_MAX_DAYS,
    Math.max(RECORDING_RETENTION_MIN_DAYS, Math.round(days)),
  );
}

export async function getRecordingRetentionDays() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, RECORDING_RETENTION_SETTING))
    .limit(1);
  return asDays(row?.value);
}

export function recordingExpiresAt(startedAt: Date, retentionDays: number) {
  return new Date(startedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export function classroomRecordingHref(classroomId: string, recordingId: string) {
  return `/api/v1/classrooms/${classroomId}/recordings/${recordingId}`;
}

function toAccessView(
  row: typeof recordings.$inferSelect,
  title: string,
  retentionDays: number,
  canRetain: boolean,
): ClassroomRecordingAccessView {
  const expires = row.retained ? null : recordingExpiresAt(row.startedAt, retentionDays);
  return {
    id: row.id,
    classroomId: row.classroomId,
    title,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    durationSeconds: row.durationSeconds,
    expiresAt: expires?.toISOString() ?? null,
    retained: row.retained,
    href: classroomRecordingHref(row.classroomId, row.id),
    canRetain,
  };
}

async function purgeRecording(row: typeof recordings.$inferSelect) {
  if (row.retained || row.status === "recording") return;
  if (row.storageKey) {
    await db.delete(files).where(eq(files.storageKey, row.storageKey));
  }
  await db
    .update(recordings)
    .set({ storageKey: null, status: "failed" })
    .where(eq(recordings.id, row.id));
}

export async function sweepExpiredRecordings() {
  const days = await getRecordingRetentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(recordings)
    .where(
      and(
        eq(recordings.retained, false),
        isNotNull(recordings.storageKey),
        lt(recordings.startedAt, cutoff),
        or(eq(recordings.status, "ready"), eq(recordings.status, "failed")),
      ),
    )
    .limit(50);
  for (const row of rows) {
    await purgeRecording(row);
  }
  return days;
}

async function parentChildIds(parentUserId: string) {
  return (
    await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, parentUserId))
  ).map((item) => item.id);
}

export async function actorCanViewClassroomRecordings(
  actor: ApiActor,
  classroom: typeof classrooms.$inferSelect,
) {
  if (canReviewRecordings(actor)) return true;
  if (actor.userId === classroom.teacherUserId) return true;
  if (classroom.bookingId) {
    const [booking] = await db
      .select({
        studentUserId: bookings.studentUserId,
        teacherUserId: bookings.teacherUserId,
      })
      .from(bookings)
      .where(eq(bookings.id, classroom.bookingId))
      .limit(1);
    if (!booking) return false;
    if (actor.userId === booking.teacherUserId || actor.userId === booking.studentUserId) {
      return true;
    }
    if (actor.roleKey === "parent") {
      const [link] = await db
        .select({ id: parentChildren.id })
        .from(parentChildren)
        .where(
          and(
            eq(parentChildren.parentUserId, actor.userId),
            eq(parentChildren.childUserId, booking.studentUserId),
          ),
        )
        .limit(1);
      return Boolean(link);
    }
    return false;
  }
  if (classroom.groupLessonId) {
    const [lesson] = await db
      .select({ teacherUserId: groupLessons.teacherUserId })
      .from(groupLessons)
      .where(eq(groupLessons.id, classroom.groupLessonId))
      .limit(1);
    if (lesson && actor.userId === lesson.teacherUserId) return true;
    const studentIds =
      actor.roleKey === "parent"
        ? await parentChildIds(actor.userId)
        : actor.roleKey === "student"
          ? [actor.userId]
          : [];
    if (!studentIds.length) return false;
    const [enrollment] = await db
      .select({ id: groupLessonEnrollments.id })
      .from(groupLessonEnrollments)
      .where(
        and(
          eq(groupLessonEnrollments.groupLessonId, classroom.groupLessonId),
          inArray(groupLessonEnrollments.studentUserId, studentIds),
          inArray(groupLessonEnrollments.status, ["confirmed", "completed"]),
        ),
      )
      .limit(1);
    return Boolean(enrollment);
  }
  return false;
}

async function requireRecordingClassroom(actor: ApiActor, classroomId: string) {
  const [row] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Classroom not found");
  }
  if (!(await actorCanViewClassroomRecordings(actor, row))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot access this lesson recording");
  }
  return row;
}

async function classroomTitles(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({
      id: classrooms.id,
      title: classrooms.title,
    })
    .from(classrooms)
    .where(inArray(classrooms.id, ids));
  return new Map(rows.map((item) => [item.id, item.title]));
}

async function visibleRecordingRows(classroomIds: string[]) {
  if (!classroomIds.length) return [];
  return db
    .select()
    .from(recordings)
    .where(
      and(
        inArray(recordings.classroomId, classroomIds),
        eq(recordings.status, "ready"),
        isNotNull(recordings.storageKey),
      ),
    )
    .orderBy(desc(recordings.startedAt))
    .limit(80);
}

export async function listClassroomRecordings(actor: ApiActor, classroomId: string) {
  const days = await sweepExpiredRecordings();
  const classroom = await requireRecordingClassroom(actor, classroomId);
  const rows = await visibleRecordingRows([classroom.id]);
  const canRetain = canReviewRecordings(actor);
  return {
    retentionDays: days,
    canRetain,
    recordings: rows.map((row) =>
      toAccessView(row, classroom.title, days, canRetain),
    ),
  };
}

export async function listAccessibleRecordings(
  actor: ApiActor,
  input?: { studentUserId?: string },
) {
  const days = await sweepExpiredRecordings();
  const canRetain = canReviewRecordings(actor);
  let classroomIds: string[] = [];

  if (canRetain) {
    const rows = await db
      .select()
      .from(recordings)
      .where(
        and(eq(recordings.status, "ready"), isNotNull(recordings.storageKey)),
      )
      .orderBy(desc(recordings.startedAt))
      .limit(80);
    const titles = await classroomTitles(rows.map((item) => item.classroomId));
    return {
      retentionDays: days,
      canRetain,
      recordings: rows.map((row) =>
        toAccessView(row, titles.get(row.classroomId) || "Lesson", days, true),
      ),
    };
  }
  if (actor.roleKey === "teacher") {
    classroomIds = (
      await db
        .select({ id: classrooms.id })
        .from(classrooms)
        .where(eq(classrooms.teacherUserId, actor.userId))
        .limit(200)
    ).map((item) => item.id);
  } else {
    const studentIds =
      actor.roleKey === "parent"
        ? input?.studentUserId
          ? (await parentChildIds(actor.userId)).includes(input.studentUserId)
            ? [input.studentUserId]
            : []
          : await parentChildIds(actor.userId)
        : actor.roleKey === "student"
          ? [actor.userId]
          : [];
    if (!studentIds.length) {
      return { retentionDays: days, canRetain, recordings: [] };
    }
    const [bookingRows, enrollmentRows] = await Promise.all([
      db
        .select({ id: bookings.id })
        .from(bookings)
        .where(inArray(bookings.studentUserId, studentIds)),
      db
        .select({ groupLessonId: groupLessonEnrollments.groupLessonId })
        .from(groupLessonEnrollments)
        .where(
          and(
            inArray(groupLessonEnrollments.studentUserId, studentIds),
            inArray(groupLessonEnrollments.status, ["confirmed", "completed"]),
          ),
        ),
    ]);
    const bookingIds = bookingRows.map((item) => item.id);
    const groupIds = enrollmentRows.map((item) => item.groupLessonId);
    const filters = [
      ...(bookingIds.length ? [inArray(classrooms.bookingId, bookingIds)] : []),
      ...(groupIds.length ? [inArray(classrooms.groupLessonId, groupIds)] : []),
    ];
    if (!filters.length) {
      return { retentionDays: days, canRetain, recordings: [] };
    }
    const roomRows = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(filters.length === 1 ? filters[0] : or(...filters));
    classroomIds = roomRows.map((item) => item.id);
  }

  const rows = await visibleRecordingRows(classroomIds);
  const titles = await classroomTitles(rows.map((item) => item.classroomId));
  return {
    retentionDays: days,
    canRetain,
    recordings: rows.map((row) =>
      toAccessView(row, titles.get(row.classroomId) || "Lesson", days, canRetain),
    ),
  };
}

export async function downloadClassroomRecording(
  actor: ApiActor,
  classroomId: string,
  recordingId: string,
) {
  await sweepExpiredRecordings();
  await requireRecordingClassroom(actor, classroomId);
  const [row] = await db
    .select()
    .from(recordings)
    .where(
      and(eq(recordings.id, recordingId), eq(recordings.classroomId, classroomId)),
    )
    .limit(1);
  if (!row?.storageKey || row.status !== "ready") {
    throw new ApiError(404, "NOT_FOUND", "This recording is no longer available");
  }
  const days = await getRecordingRetentionDays();
  if (!row.retained && recordingExpiresAt(row.startedAt, days).getTime() <= Date.now()) {
    await purgeRecording(row);
    throw new ApiError(404, "NOT_FOUND", "This recording has been removed after the retention period");
  }
  const [file] = await db
    .select({
      id: files.id,
      mimeType: files.mimeType,
      originalName: files.originalName,
    })
    .from(files)
    .where(eq(files.storageKey, row.storageKey))
    .limit(1);
  if (!file) {
    throw new ApiError(404, "NOT_FOUND", "This recording is no longer available");
  }
  const [object] = await db
    .select({ content: fileObjects.content })
    .from(fileObjects)
    .where(eq(fileObjects.fileId, file.id))
    .limit(1);
  if (!object?.content?.byteLength) {
    throw new ApiError(404, "NOT_FOUND", "This recording is no longer available");
  }
  const bytes = openSecureRecordingBytes(object.content);
  const name = file.originalName?.trim() || "lesson.webm";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType || "video/webm",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function setClassroomRecordingRetained(
  actor: ApiActor,
  classroomId: string,
  recordingId: string,
  retained: boolean,
  ip: string,
) {
  if (!canReviewRecordings(actor)) {
    throw new ApiError(403, "FORBIDDEN", "Only safeguarding staff can retain a recording");
  }
  await requireRecordingClassroom(actor, classroomId);
  const [saved] = await db
    .update(recordings)
    .set({ retained })
    .where(
      and(eq(recordings.id, recordingId), eq(recordings.classroomId, classroomId)),
    )
    .returning();
  if (!saved) {
    throw new ApiError(404, "NOT_FOUND", "Recording not found");
  }
  await writeAuditLog({
    actor,
    action: retained ? "recording.retained" : "recording.released",
    entityType: "recording",
    entityId: saved.id,
    ipAddress: ip,
    metadata: { classroomId, retained },
  });
  const days = await getRecordingRetentionDays();
  const [classroom] = await db
    .select({ title: classrooms.title })
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  return toAccessView(saved, classroom?.title || "Lesson", days, true);
}

export async function updateRecordingRetentionDays(
  actor: ApiActor,
  days: number,
  ip: string,
) {
  if (!canEditRetention(actor)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change recording retention");
  }
  const retentionDays = asDays(days);
  await db
    .insert(platformSettings)
    .values({ key: RECORDING_RETENTION_SETTING, value: retentionDays })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: retentionDays },
    });
  await writeAuditLog({
    actor,
    action: "settings.recording_retention_updated",
    entityType: "platform_settings",
    entityId: RECORDING_RETENTION_SETTING,
    ipAddress: ip,
    metadata: { retentionDays },
  });
  await sweepExpiredRecordings();
  return { retentionDays };
}
