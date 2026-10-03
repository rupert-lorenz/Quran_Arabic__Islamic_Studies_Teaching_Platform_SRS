import { and, desc, eq, gt, inArray, like, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  bookings,
  classroomFiles,
  classroomMessages,
  classroomParticipants,
  classrooms,
  fileObjects,
  files,
  groupLessonEnrollments,
  groupLessons,
  parentChildren,
  recordings,
  users,
} from "@/db/schema";
import type {
  ClassroomPresentation,
  ClassroomWhiteboardDocument,
  ClassroomWhiteboardStroke,
} from "@/db/schema/classrooms";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import {
  CLASSROOM_MAX_MESSAGES,
  classroomContainsContactDetails,
  classroomJoinWindow,
  classroomOpenBeforeMs,
  classroomStatusAllowsJoin,
  sortClassroomParticipants,
  type ClassroomLessonKind,
  type ClassroomParticipantRole,
} from "@/lib/classroom";
import { accumulateAttendedSeconds } from "@/server/classroom/attendance";
import { safeRecordPresence } from "@/server/lms/presence";
import {
  CLASSROOM_MAX_FILES,
  CLASSROOM_MAX_FILE_BYTES,
  asciiDownloadName,
  classroomFileHref,
  resolveClassroomFileType,
  sanitizeClassroomFileName,
  type ClassroomSharedFile,
} from "@/lib/classroom-files";
import {
  CLASSROOM_MAX_BOARD_IMAGES,
  addWhiteboardPage,
  addWhiteboardStroke,
  annotateWhiteboardFile,
  classroomRoleCanAnnotate,
  clearWhiteboardPage,
  detectClassroomTextDirection,
  isClassroomBoardImageType,
  normalizeClassroomWhiteboard,
  parseClassroomAnnotatorRole,
  parseClassroomWhiteboardStroke,
  redoWhiteboard,
  removeWhiteboardPage,
  removeWhiteboardStrokes,
  sanitizeClassroomAnnotatorName,
  sanitizeClassroomWhiteboardText,
  setWhiteboardFollowPage,
  setWhiteboardStudentsCanAnnotate,
  undoWhiteboard,
  whiteboardPageById,
  classroomStudentsCanAnnotate,
} from "@/lib/classroom-whiteboard";
import { classroomTajweedRule } from "@/lib/classroom-tajweed";
import { isClassroomEpubType, parseEpubPages } from "@/lib/classroom-epub";
import { parsePdfPages } from "@/lib/classroom-pdf";
import {
  boardOntoPresentation,
  classroomPresentationSlideIds,
  isClassroomPptxType,
  isClassroomPresentableType,
  parseClassroomPresentation,
  toggleClassroomBookmark,
  parsePptxSlides,
  presentationAsBoard,
  type ClassroomParsedSlide,
} from "@/lib/classroom-pptx";
import {
  CLASSROOM_MAX_RECORDING_BYTES,
  CLASSROOM_RECORDING_CHUNK_MAX_BYTES,
} from "@/lib/classroom-recording";
import {
  appendSecureRecordingChunk,
  classroomRecordingStorageKey,
  emptySecureRecordingEnvelope,
} from "@/server/classroom/recording-storage";
import {
  listClassroomRecordings,
  type ClassroomRecordingAccessView,
} from "@/server/classroom/recording-access";
import { ApiError } from "@/server/api/errors";
import type { ApiActor } from "@/server/api/auth";
import {
  issueClassroomJoinToken,
  verifyClassroomJoinToken,
  type ClassroomProviderJoin,
} from "./adapter";
import {
  broadcastClassroomSignal,
  dropClassroomPresence,
  enqueueClassroomSignal,
  listClassroomPresence,
  takeClassroomSignals,
  touchClassroomPresence,
  type ClassroomPresence,
  type ClassroomSignal,
} from "./signaling";

const STAFF_JOIN_PERMISSIONS = [
  "classes.manage",
  "teachers.approve",
  "safeguarding.recordings",
] as const;

export type ClassroomView = {
  id: string;
  title: string;
  subjectSlug: string;
  status: string;
  bookingId: string | null;
  groupLessonId: string | null;
  teacherUserId: string;
  recordingEnabled: boolean;
  joinOpensAt: string;
  joinClosesAt: string;
  startsAt: string;
  endsAt: string;
  kind: ClassroomLessonKind;
  studentCapacity: number;
};

export type ClassroomSessionView = {
  classroom: ClassroomView;
  self: {
    userId: string;
    displayName: string;
    role: ClassroomParticipantRole;
    canPublish: boolean;
    canRecord: boolean;
    canClearBoard: boolean;
    canControlMedia: boolean;
    canShareFiles: boolean;
    canDraw: boolean;
    canRetainRecordings: boolean;
  };
  join: ClassroomProviderJoin;
  participants: {
    userId: string;
    displayName: string;
    role: string;
    lastSeenAt: string | null;
    cameraOn: boolean;
    micOn: boolean;
    screenSharing: boolean;
    present: boolean;
  }[];
  messages: ClassroomMessageView[];
  files: ClassroomSharedFile[];
  whiteboard: ClassroomWhiteboardDocument;
  presentation: ClassroomPresentation | null;
  recording: {
    id: string;
    status: string;
    startedAt: string;
    durationSeconds?: number | null;
  } | null;
  recordings: ClassroomRecordingAccessView[];
  retentionDays: number;
};

export type ClassroomMessageView = {
  id: string;
  userId: string;
  displayName: string;
  role: string;
  body: string;
  createdAt: string;
};

type LessonAccess = {
  kind: ClassroomLessonKind;
  bookingId?: string;
  groupLessonId?: string;
  teacherUserId: string;
  title: string;
  subjectSlug: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  role: ClassroomParticipantRole;
  studentCapacity: number;
};

function displayNameOf(actor: ApiActor) {
  return actor.displayName?.trim() || "Participant";
}

function canStaffJoin(actor: ApiActor) {
  return (
    isStaffRole(actor.roleKey) &&
    hasAnyPermission(actor, [...STAFF_JOIN_PERMISSIONS])
  );
}

function canManageRecording(role: ClassroomParticipantRole) {
  return role === "teacher" || role === "staff";
}

async function loadBookingAccess(
  actor: ApiActor,
  bookingId: string,
): Promise<LessonAccess> {
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Booking not found");
  }
  if (!classroomStatusAllowsJoin("booking", row.status)) {
    throw new ApiError(409, "CLASSROOM_CLOSED", "This lesson is not available");
  }

  let role: ClassroomParticipantRole | null = null;
  if (actor.userId === row.teacherUserId) role = "teacher";
  else if (actor.userId === row.studentUserId) role = "student";
  else if (canStaffJoin(actor)) role = "staff";
  else if (actor.roleKey === "parent") {
    const [link] = await db
      .select({ id: parentChildren.id })
      .from(parentChildren)
      .where(
        and(
          eq(parentChildren.parentUserId, actor.userId),
          eq(parentChildren.childUserId, row.studentUserId),
        ),
      )
      .limit(1);
    if (link) role = "parent";
  }
  if (!role) {
    throw new ApiError(403, "FORBIDDEN", "You cannot join this classroom");
  }

  return {
    kind: "booking",
    bookingId: row.id,
    teacherUserId: row.teacherUserId,
    title: row.kind === "trial" ? "Trial lesson" : "One-to-one lesson",
    subjectSlug: row.subjectSlug,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    role,
    studentCapacity: 1,
  };
}

async function loadGroupAccess(
  actor: ApiActor,
  groupLessonId: string,
): Promise<LessonAccess> {
  const [row] = await db
    .select()
    .from(groupLessons)
    .where(eq(groupLessons.id, groupLessonId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Group lesson not found");
  }
  if (!classroomStatusAllowsJoin("group", row.status)) {
    throw new ApiError(409, "CLASSROOM_CLOSED", "This class is not available");
  }

  let role: ClassroomParticipantRole | null = null;
  if (actor.userId === row.teacherUserId) role = "teacher";
  else if (canStaffJoin(actor)) role = "staff";
  else {
    const studentIds =
      actor.roleKey === "parent"
        ? (
            await db
              .select({ id: parentChildren.childUserId })
              .from(parentChildren)
              .where(eq(parentChildren.parentUserId, actor.userId))
          ).map((item) => item.id)
        : actor.roleKey === "student"
          ? [actor.userId]
          : [];
    if (studentIds.length) {
      const [enrollment] = await db
        .select({ studentUserId: groupLessonEnrollments.studentUserId })
        .from(groupLessonEnrollments)
        .where(
          and(
            eq(groupLessonEnrollments.groupLessonId, row.id),
            eq(groupLessonEnrollments.status, "confirmed"),
            inArray(groupLessonEnrollments.studentUserId, studentIds),
          ),
        )
        .limit(1);
      if (enrollment) {
        role = actor.userId === enrollment.studentUserId ? "student" : "parent";
      }
    }
  }
  if (!role) {
    throw new ApiError(403, "FORBIDDEN", "You cannot join this classroom");
  }

  return {
    kind: "group",
    groupLessonId: row.id,
    teacherUserId: row.teacherUserId,
    title: row.title,
    subjectSlug: row.subjectSlug,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    role,
    studentCapacity: row.capacity,
  };
}

async function resolveLessonAccess(
  actor: ApiActor,
  input: { bookingId?: string; groupLessonId?: string },
) {
  if (input.bookingId) return loadBookingAccess(actor, input.bookingId);
  if (input.groupLessonId) return loadGroupAccess(actor, input.groupLessonId);
  throw new ApiError(400, "VALIDATION", "Join with a booking or group lesson");
}

function derivedClassroomStatus(
  window: ReturnType<typeof classroomJoinWindow>,
  live: boolean,
) {
  if (window.ended) return "ended" as const;
  if (window.upcoming) return "scheduled" as const;
  return live ? ("live" as const) : ("open" as const);
}

function assertJoinWindow(access: LessonAccess) {
  const window = classroomJoinWindow(
    access.startsAt,
    access.endsAt,
    Date.now(),
    classroomOpenBeforeMs(access.role),
  );
  if (window.upcoming) {
    throw new ApiError(
      409,
      "CLASSROOM_NOT_OPEN",
      access.role === "teacher" || access.role === "staff"
        ? "The classroom opens 60 minutes before the lesson"
        : "The classroom opens 15 minutes before the lesson",
      {
        startsAt: access.startsAt.toISOString(),
        endsAt: access.endsAt.toISOString(),
      },
    );
  }
  if (window.ended) {
    throw new ApiError(409, "CLASSROOM_ENDED", "This classroom has closed");
  }
  return window;
}

async function ensureClassroom(access: LessonAccess) {
  const window = classroomJoinWindow(
    access.startsAt,
    access.endsAt,
    Date.now(),
    classroomOpenBeforeMs(access.role),
  );
  const existing = access.bookingId
    ? await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.bookingId, access.bookingId))
        .limit(1)
    : await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.groupLessonId, access.groupLessonId!))
        .limit(1);
  if (existing[0]) {
    return existing[0];
  }
  try {
    const [created] = await db
      .insert(classrooms)
      .values({
        bookingId: access.bookingId,
        groupLessonId: access.groupLessonId,
        teacherUserId: access.teacherUserId,
        subjectSlug: access.subjectSlug,
        title: access.title,
        status: derivedClassroomStatus(window, false),
        joinOpensAt: window.opensAt,
        joinClosesAt: window.closesAt,
      })
      .returning();
    return created;
  } catch {
    const [again] = access.bookingId
      ? await db
          .select()
          .from(classrooms)
          .where(eq(classrooms.bookingId, access.bookingId))
          .limit(1)
      : await db
          .select()
          .from(classrooms)
          .where(eq(classrooms.groupLessonId, access.groupLessonId!))
          .limit(1);
    if (again) return again;
    throw new ApiError(500, "INTERNAL", "Could not open the classroom");
  }
}

async function requireClassroomRow(classroomId: string) {
  const [row] = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Classroom not found");
  }
  return row;
}

async function requireClassroomAccess(actor: ApiActor, classroomId: string) {
  const row = await requireClassroomRow(classroomId);
  const access = await resolveLessonAccess(actor, {
    bookingId: row.bookingId ?? undefined,
    groupLessonId: row.groupLessonId ?? undefined,
  });
  return { row, access };
}

async function requireLiveClassroom(actor: ApiActor, classroomId: string) {
  const { row, access } = await requireClassroomAccess(actor, classroomId);
  assertJoinWindow(access);
  return { row, access };
}

async function upsertParticipant(
  classroomId: string,
  actor: ApiActor,
  role: ClassroomParticipantRole,
) {
  const [existing] = await db
    .select()
    .from(classroomParticipants)
    .where(
      and(
        eq(classroomParticipants.classroomId, classroomId),
        eq(classroomParticipants.userId, actor.userId),
      ),
    )
    .limit(1);
  if (existing) {
    const now = new Date();
    const attendedSeconds = existing.leftAt
      ? existing.attendedSeconds
      : accumulateAttendedSeconds(
          existing.attendedSeconds,
          existing.lastSeenAt,
          now,
        );
    const [updated] = await db
      .update(classroomParticipants)
      .set({
        role,
        lastSeenAt: now,
        leftAt: null,
        attendedSeconds,
      })
      .where(eq(classroomParticipants.id, existing.id))
      .returning();
    return { participant: updated, entered: Boolean(existing.leftAt) };
  }
  const [created] = await db
    .insert(classroomParticipants)
    .values({
      classroomId,
      userId: actor.userId,
      role,
    })
    .returning();
  return { participant: created, entered: true };
}

async function listMessageViews(classroomId: string, after?: Date) {
  const rows = await db
    .select({
      id: classroomMessages.id,
      userId: classroomMessages.userId,
      body: classroomMessages.body,
      createdAt: classroomMessages.createdAt,
      displayName: users.displayName,
      role: classroomParticipants.role,
    })
    .from(classroomMessages)
    .innerJoin(users, eq(users.id, classroomMessages.userId))
    .leftJoin(
      classroomParticipants,
      and(
        eq(classroomParticipants.classroomId, classroomMessages.classroomId),
        eq(classroomParticipants.userId, classroomMessages.userId),
      ),
    )
    .where(
      after
        ? and(
            eq(classroomMessages.classroomId, classroomId),
            gt(classroomMessages.createdAt, after),
          )
        : eq(classroomMessages.classroomId, classroomId),
    )
    .orderBy(desc(classroomMessages.createdAt))
    .limit(CLASSROOM_MAX_MESSAGES);
  return rows
    .reverse()
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      displayName: row.displayName,
      role: row.role ?? "student",
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    }));
}

async function listFileViews(classroomId: string): Promise<ClassroomSharedFile[]> {
  const rows = await db
    .select({
      id: files.id,
      name: files.originalName,
      mimeType: files.mimeType,
      byteSize: files.byteSize,
      userId: classroomFiles.uploadedByUserId,
      displayName: users.displayName,
      role: classroomParticipants.role,
      createdAt: classroomFiles.createdAt,
    })
    .from(classroomFiles)
    .innerJoin(files, eq(files.id, classroomFiles.fileId))
    .innerJoin(users, eq(users.id, classroomFiles.uploadedByUserId))
    .leftJoin(
      classroomParticipants,
      and(
        eq(classroomParticipants.classroomId, classroomFiles.classroomId),
        eq(classroomParticipants.userId, classroomFiles.uploadedByUserId),
      ),
    )
    .where(eq(classroomFiles.classroomId, classroomId))
    .orderBy(classroomFiles.createdAt)
    .limit(CLASSROOM_MAX_FILES);
  return rows.map((row) => ({
    id: row.id,
    name: row.name?.trim() || "file",
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    userId: row.userId,
    displayName: row.displayName,
    role: row.role ?? "student",
    createdAt: row.createdAt.toISOString(),
    href: classroomFileHref(classroomId, row.id),
  }));
}

async function classroomStoredFile(classroomId: string, fileId: string) {
  const [item] = await db
    .select({
      id: files.id,
      name: files.originalName,
      mimeType: files.mimeType,
      content: fileObjects.content,
    })
    .from(files)
    .innerJoin(fileObjects, eq(fileObjects.fileId, files.id))
    .where(
      and(
        eq(files.id, fileId),
        ne(files.purpose, "recording"),
        like(files.storageKey, `classroom:${classroomId}:%`),
      ),
    )
    .limit(1);
  return item ?? null;
}

async function classroomStoredImage(classroomId: string, fileId: string) {
  const file = await classroomStoredFile(classroomId, fileId);
  if (!file || !isClassroomBoardImageType(file.mimeType)) return null;
  return file;
}

async function fanoutClassroomPresentation(
  classroomId: string,
  fromUserId: string,
  presentation: ClassroomPresentation | null,
) {
  const others = (await listClassroomPresence(classroomId))
    .filter((item) => item.userId !== fromUserId)
    .map((item) => item.userId);
  if (!others.length) return;
  await broadcastClassroomSignal(classroomId, others, {
    id: randomUUID(),
    type: "presentation",
    fromUserId,
    payload: { presentation },
    createdAt: Date.now(),
  });
}

async function savePresentation(
  classroomId: string,
  fromUserId: string,
  presentation: ClassroomPresentation | null,
) {
  await db
    .update(classrooms)
    .set({ presentation })
    .where(eq(classrooms.id, classroomId));
  await fanoutClassroomPresentation(classroomId, fromUserId, presentation);
  return { presentation };
}

async function storePresentationSlides(
  classroomId: string,
  ownerUserId: string,
  parsed: ClassroomParsedSlide[],
) {
  const slides: ClassroomPresentation["slides"] = [];
  for (const [index, slide] of parsed.entries()) {
    let imageFileId: string | undefined;
    if (slide.image) {
      imageFileId = randomUUID();
      const name = sanitizeClassroomFileName(slide.image.name);
      await db.insert(files).values({
        id: imageFileId,
        ownerUserId,
        purpose: "teaching_material",
        storageKey: `classroom:${classroomId}:slide:${imageFileId}:${name}`,
        mimeType: slide.image.mimeType,
        byteSize: slide.image.bytes.byteLength,
        originalName: name,
        visibility: "restricted",
      });
      await db.insert(fileObjects).values({
        fileId: imageFileId,
        content: slide.image.bytes,
      });
    }
    slides.push({
      id: `slide-${index + 1}`,
      title: slide.title,
      body: slide.body,
      imageFileId,
      dir: slide.dir,
    });
  }
  return slides;
}

async function deleteUnusedSlideImages(classroomId: string, keep: Set<string>) {
  const [row] = await db
    .select({ whiteboard: classrooms.whiteboard })
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  const used = new Set(keep);
  const board = normalizeClassroomWhiteboard(row?.whiteboard);
  for (const page of board.pages) {
    if (page.backgroundFileId) used.add(page.backgroundFileId);
    for (const stroke of page.strokes) {
      if (stroke.kind === "image" && stroke.fileId) used.add(stroke.fileId);
    }
  }
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(like(files.storageKey, `classroom:${classroomId}:slide:%`));
  const stale = rows.filter((item) => !used.has(item.id)).map((item) => item.id);
  if (stale.length) {
    await db.delete(files).where(inArray(files.id, stale));
  }
}

async function replaceClassroomPresentation(
  classroomId: string,
  fromUserId: string,
  presentation: ClassroomPresentation | null,
) {
  await db
    .update(classrooms)
    .set({ presentation })
    .where(eq(classrooms.id, classroomId));
  await deleteUnusedSlideImages(
    classroomId,
    new Set(classroomPresentationSlideIds(presentation)),
  );
  await fanoutClassroomPresentation(classroomId, fromUserId, presentation);
  return { presentation };
}

async function fanoutClassroomFile(
  classroomId: string,
  fromUserId: string,
  payload: { action: "added" | "removed"; file: ClassroomSharedFile },
) {
  const others = (await listClassroomPresence(classroomId))
    .filter((item) => item.userId !== fromUserId)
    .map((item) => item.userId);
  if (!others.length) return;
  await broadcastClassroomSignal(classroomId, others, {
    id: randomUUID(),
    type: "file",
    fromUserId,
    payload,
    createdAt: Date.now(),
  });
}

async function activeRecording(classroomId: string) {
  const [row] = await db
    .select()
    .from(recordings)
    .where(
      and(eq(recordings.classroomId, classroomId), eq(recordings.status, "recording")),
    )
    .orderBy(desc(recordings.startedAt))
    .limit(1);
  return row ?? null;
}

function toRecordingView(row: typeof recordings.$inferSelect) {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    durationSeconds: row.durationSeconds,
  };
}

async function fanoutClassroomRecording(
  classroomId: string,
  fromUserId: string,
  recording: ClassroomSessionView["recording"],
) {
  const others = (await listClassroomPresence(classroomId))
    .filter((item) => item.userId !== fromUserId)
    .map((item) => item.userId);
  if (!others.length) return;
  await broadcastClassroomSignal(classroomId, others, {
    id: randomUUID(),
    type: "recording",
    fromUserId,
    payload: { recording },
    createdAt: Date.now(),
  });
}

async function attachRecordingFile(
  classroomId: string,
  recordingId: string,
  ownerUserId: string,
) {
  const fileId = randomUUID();
  const storageKey = classroomRecordingStorageKey(classroomId, recordingId);
  await db.insert(files).values({
    id: fileId,
    ownerUserId,
    purpose: "recording",
    storageKey,
    mimeType: "video/webm",
    byteSize: 0,
    originalName: "lesson.webm",
    visibility: "private",
  });
  await db.insert(fileObjects).values({
    fileId,
    content: emptySecureRecordingEnvelope(),
  });
  await db
    .update(recordings)
    .set({ storageKey })
    .where(eq(recordings.id, recordingId));
  return storageKey;
}

function toPresenceParticipant(item: ClassroomPresence) {
  return {
    userId: item.userId,
    displayName: item.displayName,
    role: item.role,
    lastSeenAt: new Date(item.lastSeenAt).toISOString(),
    cameraOn: item.cameraOn,
    micOn: item.micOn,
    screenSharing: item.screenSharing,
    present: true,
  };
}

async function namesForRoster(
  people: { userId: string; role: ClassroomParticipantRole }[],
) {
  if (!people.length) return [];
  const rows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(
      inArray(
        users.id,
        people.map((item) => item.userId),
      ),
    );
  const names = new Map(rows.map((row) => [row.id, row.displayName]));
  return people.map((person) => ({
    userId: person.userId,
    displayName: names.get(person.userId)?.trim() || "Participant",
    role: person.role,
  }));
}

async function listExpectedRoster(access: LessonAccess) {
  if (access.kind === "booking" && access.bookingId) {
    const [row] = await db
      .select({
        teacherUserId: bookings.teacherUserId,
        studentUserId: bookings.studentUserId,
      })
      .from(bookings)
      .where(eq(bookings.id, access.bookingId))
      .limit(1);
    if (!row) return [];
    return namesForRoster([
      { userId: row.teacherUserId, role: "teacher" },
      { userId: row.studentUserId, role: "student" },
    ]);
  }
  if (access.kind === "group" && access.groupLessonId) {
    const enrollments = await db
      .select({ studentUserId: groupLessonEnrollments.studentUserId })
      .from(groupLessonEnrollments)
      .where(
        and(
          eq(groupLessonEnrollments.groupLessonId, access.groupLessonId),
          eq(groupLessonEnrollments.status, "confirmed"),
        ),
      );
    return namesForRoster([
      { userId: access.teacherUserId, role: "teacher" },
      ...enrollments.map((item) => ({
        userId: item.studentUserId,
        role: "student" as const,
      })),
    ]);
  }
  return [];
}

function mergeClassroomRoster(
  expected: { userId: string; displayName: string; role: string }[],
  presence: ClassroomPresence[],
) {
  const byId = new Map<string, ClassroomSessionView["participants"][number]>();
  for (const person of expected) {
    byId.set(person.userId, {
      userId: person.userId,
      displayName: person.displayName,
      role: person.role,
      lastSeenAt: null,
      cameraOn: false,
      micOn: false,
      screenSharing: false,
      present: false,
    });
  }
  for (const item of presence) {
    byId.set(item.userId, toPresenceParticipant(item));
  }
  return sortClassroomParticipants([...byId.values()]);
}

function toClassroomView(
  row: typeof classrooms.$inferSelect,
  access: LessonAccess,
): ClassroomView {
  return {
    id: row.id,
    title: row.title,
    subjectSlug: row.subjectSlug,
    status: row.status,
    bookingId: row.bookingId,
    groupLessonId: row.groupLessonId,
    teacherUserId: row.teacherUserId,
    recordingEnabled: row.recordingEnabled,
    joinOpensAt: row.joinOpensAt.toISOString(),
    joinClosesAt: row.joinClosesAt.toISOString(),
    startsAt: access.startsAt.toISOString(),
    endsAt: access.endsAt.toISOString(),
    kind: access.kind,
    studentCapacity: access.studentCapacity,
  };
}

async function buildSession(
  actor: ApiActor,
  row: typeof classrooms.$inferSelect,
  access: LessonAccess,
): Promise<ClassroomSessionView> {
  const [presence, messages, sharedFiles, recording, expected, saved] = await Promise.all([
    listClassroomPresence(row.id),
    listMessageViews(row.id),
    listFileViews(row.id),
    activeRecording(row.id),
    listExpectedRoster(access),
    listClassroomRecordings(actor, row.id),
  ]);
  const whiteboard = normalizeClassroomWhiteboard(row.whiteboard);
  return {
    classroom: toClassroomView(row, access),
    self: {
      userId: actor.userId,
      displayName: displayNameOf(actor),
      role: access.role,
      canPublish: access.role !== "parent",
      canRecord: canManageRecording(access.role),
      canClearBoard: canManageRecording(access.role),
      canControlMedia: canManageRecording(access.role),
      canShareFiles: access.role !== "parent",
      canDraw: classroomRoleCanAnnotate(access.role, whiteboard),
      canRetainRecordings: saved.canRetain,
    },
    join: issueClassroomJoinToken({
      classroomId: row.id,
      userId: actor.userId,
      role: access.role,
      displayName: displayNameOf(actor),
    }),
    participants: mergeClassroomRoster(expected, presence),
    messages,
    files: sharedFiles,
    whiteboard,
    presentation: parseClassroomPresentation(row.presentation),
    recording: recording ? toRecordingView(recording) : null,
    recordings: saved.recordings,
    retentionDays: saved.retentionDays,
  };
}

async function markClassroomLive(classroomId: string, live: boolean, access: LessonAccess) {
  const window = classroomJoinWindow(
    access.startsAt,
    access.endsAt,
    Date.now(),
    classroomOpenBeforeMs(access.role),
  );
  await db
    .update(classrooms)
    .set({ status: derivedClassroomStatus(window, live) })
    .where(eq(classrooms.id, classroomId));
}

export async function joinClassroom(
  actor: ApiActor,
  input: { bookingId?: string; groupLessonId?: string },
) {
  const access = await resolveLessonAccess(actor, input);
  assertJoinWindow(access);
  const row = await ensureClassroom(access);
  const joined = await upsertParticipant(row.id, actor, access.role);
  await touchClassroomPresence(row.id, {
    userId: actor.userId,
    displayName: displayNameOf(actor),
    role: access.role,
  });
  if (joined.entered) {
    await safeRecordPresence({
      userId: actor.userId,
      kind: "lesson_enter",
      classroomId: row.id,
      title: access.title || row.title,
    });
  }
  await markClassroomLive(row.id, true, access);
  const latest = await requireClassroomRow(row.id);
  return buildSession(actor, latest, access);
}

export async function getClassroomSession(actor: ApiActor, classroomId: string) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  const joined = await upsertParticipant(row.id, actor, access.role);
  await touchClassroomPresence(row.id, {
    userId: actor.userId,
    displayName: displayNameOf(actor),
    role: access.role,
  });
  if (joined.entered) {
    await safeRecordPresence({
      userId: actor.userId,
      kind: "lesson_enter",
      classroomId: row.id,
      title: access.title || row.title,
    });
  }
  return buildSession(actor, row, access);
}

export async function heartbeatClassroom(
  actor: ApiActor,
  classroomId: string,
  media?: { cameraOn?: boolean; micOn?: boolean; screenSharing?: boolean },
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  await upsertParticipant(row.id, actor, access.role);
  await touchClassroomPresence(row.id, {
    userId: actor.userId,
    displayName: displayNameOf(actor),
    role: access.role,
    cameraOn: media?.cameraOn,
    micOn: media?.micOn,
    screenSharing: media?.screenSharing,
  });
  return { ok: true as const };
}

export async function leaveClassroom(actor: ApiActor, classroomId: string) {
  const { row } = await requireClassroomAccess(actor, classroomId);
  const remaining = await listClassroomPresence(row.id);
  const now = new Date();
  const [existing] = await db
    .select()
    .from(classroomParticipants)
    .where(
      and(
        eq(classroomParticipants.classroomId, row.id),
        eq(classroomParticipants.userId, actor.userId),
      ),
    )
    .limit(1);
  if (existing && !existing.leftAt) {
    await db
      .update(classroomParticipants)
      .set({
        leftAt: now,
        lastSeenAt: now,
        attendedSeconds: accumulateAttendedSeconds(
          existing.attendedSeconds,
          existing.lastSeenAt,
          now,
        ),
      })
      .where(eq(classroomParticipants.id, existing.id));
    await safeRecordPresence({
      userId: actor.userId,
      kind: "lesson_exit",
      classroomId: row.id,
      title: row.title,
    });
  }
  await dropClassroomPresence(row.id, actor.userId);
  await Promise.all(
    remaining
      .filter((person) => person.userId !== actor.userId)
      .map((person) =>
        enqueueClassroomSignal(row.id, {
          id: randomUUID(),
          type: "hangup",
          fromUserId: actor.userId,
          toUserId: person.userId,
          payload: {},
          createdAt: Date.now(),
        }),
      ),
  );
  const stillHere = remaining.filter((person) => person.userId !== actor.userId);
  if (!stillHere.length) {
    const access = await resolveLessonAccess(actor, {
      bookingId: row.bookingId ?? undefined,
      groupLessonId: row.groupLessonId ?? undefined,
    });
    await markClassroomLive(row.id, false, access);
  }
  return { ok: true as const };
}

export async function syncClassroom(
  actor: ApiActor,
  classroomId: string,
  after?: string,
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  await touchClassroomPresence(row.id, {
    userId: actor.userId,
    displayName: displayNameOf(actor),
    role: access.role,
  });
  const afterDate =
    after && !Number.isNaN(Date.parse(after)) ? new Date(after) : undefined;
  const [presence, messages, sharedFiles, signals, recording, expected, saved] =
    await Promise.all([
      listClassroomPresence(row.id),
      listMessageViews(row.id, afterDate),
      listFileViews(row.id),
      takeClassroomSignals(row.id, actor.userId),
      activeRecording(row.id),
      listExpectedRoster(access),
      listClassroomRecordings(actor, row.id),
    ]);
  return {
    classroom: toClassroomView(row, access),
    participants: mergeClassroomRoster(expected, presence),
    messages,
    files: sharedFiles,
    whiteboard: normalizeClassroomWhiteboard(row.whiteboard),
    presentation: parseClassroomPresentation(row.presentation),
    signals,
    recording: recording ? toRecordingView(recording) : null,
    recordings: saved.recordings,
    retentionDays: saved.retentionDays,
  };
}

export async function postClassroomMessage(
  actor: ApiActor,
  classroomId: string,
  body: string,
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  if (classroomContainsContactDetails(body)) {
    const { flagContactShare } = await import("@/server/communications/guard");
    await flagContactShare(actor, "classroom");
    throw new ApiError(
      422,
      "CONTACT_BLOCKED",
      "Keep phone numbers and personal accounts off the classroom",
    );
  }
  const [saved] = await db
    .insert(classroomMessages)
    .values({
      classroomId: row.id,
      userId: actor.userId,
      body,
    })
    .returning();
  const message = {
    id: saved.id,
    userId: actor.userId,
    displayName: displayNameOf(actor),
    role: access.role,
    body: saved.body,
    createdAt: saved.createdAt.toISOString(),
  } satisfies ClassroomMessageView;
  const others = (await listClassroomPresence(row.id))
    .filter((item) => item.userId !== actor.userId)
    .map((item) => item.userId);
  if (others.length) {
    await broadcastClassroomSignal(row.id, others, {
      id: randomUUID(),
      type: "chat",
      fromUserId: actor.userId,
      payload: message,
      createdAt: Date.now(),
    });
  }
  return message;
}

export async function uploadClassroomFile(
  actor: ApiActor,
  classroomId: string,
  input: { name: string; mimeType: string; bytes: Buffer },
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  if (access.role === "parent") {
    throw new ApiError(403, "FORBIDDEN", "Parent observers can download files but cannot share them");
  }
  const name = sanitizeClassroomFileName(input.name);
  if (classroomContainsContactDetails(name)) {
    const { flagContactShare } = await import("@/server/communications/guard");
    await flagContactShare(actor, "files");
    throw new ApiError(
      422,
      "CONTACT_BLOCKED",
      "Keep phone numbers and personal accounts off file names",
    );
  }
  const mimeType = resolveClassroomFileType(input.mimeType, name);
  if (!mimeType) {
    throw new ApiError(422, "VALIDATION", "That file type cannot be shared in the classroom");
  }
  if (input.bytes.byteLength < 1) {
    throw new ApiError(422, "VALIDATION", "Choose a file to share");
  }
  if (input.bytes.byteLength > CLASSROOM_MAX_FILE_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "That file is larger than 8 MB");
  }
  let parsedDeck: { kind: "pptx" | "pdf" | "epub"; slides: ClassroomParsedSlide[] } | undefined;
  if (isClassroomPresentableType(mimeType)) {
    try {
      parsedDeck = parseClassroomBook(mimeType, input.bytes);
    } catch (error) {
      throw new ApiError(
        422,
        "VALIDATION",
        error instanceof Error ? error.message : presentableParseError(mimeType),
      );
    }
  }
  const existing = await db
    .select({ id: classroomFiles.id })
    .from(classroomFiles)
    .where(eq(classroomFiles.classroomId, row.id));
  if (existing.length >= CLASSROOM_MAX_FILES) {
    throw new ApiError(409, "LOCKED", "This lesson already has the maximum number of files");
  }
  const fileId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(files).values({
      id: fileId,
      ownerUserId: actor.userId,
      purpose: "teaching_material",
      storageKey: `classroom:${row.id}:${fileId}:${name}`,
      mimeType,
      byteSize: input.bytes.byteLength,
      originalName: name,
      visibility: "restricted",
    });
    await tx.insert(fileObjects).values({
      fileId,
      content: input.bytes,
    });
    await tx.insert(classroomFiles).values({
      classroomId: row.id,
      fileId,
      uploadedByUserId: actor.userId,
    });
  });
  if (parsedDeck) {
    await replaceClassroomPresentation(row.id, actor.userId, {
      fileId,
      name,
      kind: parsedDeck.kind,
      slideIndex: 0,
      open: false,
      slides: await storePresentationSlides(row.id, actor.userId, parsedDeck.slides),
    });
  }
  const [saved] = await db
    .select({ createdAt: classroomFiles.createdAt })
    .from(classroomFiles)
    .where(eq(classroomFiles.fileId, fileId))
    .limit(1);
  const shared: ClassroomSharedFile = {
    id: fileId,
    name,
    mimeType,
    byteSize: input.bytes.byteLength,
    userId: actor.userId,
    displayName: displayNameOf(actor),
    role: access.role,
    createdAt: (saved?.createdAt ?? new Date()).toISOString(),
    href: classroomFileHref(row.id, fileId),
  };
  await fanoutClassroomFile(row.id, actor.userId, { action: "added", file: shared });
  return shared;
}

export async function downloadClassroomFile(
  actor: ApiActor,
  classroomId: string,
  fileId: string,
) {
  const { row } = await requireLiveClassroom(actor, classroomId);
  const item = await classroomStoredFile(row.id, fileId);
  if (!item?.content) {
    throw new ApiError(404, "NOT_FOUND", "That file is not in this classroom");
  }
  const name = item.name?.trim() || "file";
  const encoded = encodeURIComponent(name);
  const inline =
    item.mimeType.startsWith("image/") || item.mimeType === "application/pdf";
  return new Response(new Uint8Array(item.content), {
    headers: {
      "Content-Type": item.mimeType,
      "Content-Length": String(item.content.byteLength),
      "Content-Disposition": `${
        inline ? "inline" : "attachment"
      }; filename="${asciiDownloadName(name)}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function removeClassroomFile(
  actor: ApiActor,
  classroomId: string,
  fileId: string,
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  const [item] = await db
    .select({
      fileId: classroomFiles.fileId,
      uploadedByUserId: classroomFiles.uploadedByUserId,
      name: files.originalName,
      mimeType: files.mimeType,
      byteSize: files.byteSize,
      createdAt: classroomFiles.createdAt,
    })
    .from(classroomFiles)
    .innerJoin(files, eq(files.id, classroomFiles.fileId))
    .where(
      and(eq(classroomFiles.classroomId, row.id), eq(classroomFiles.fileId, fileId)),
    )
    .limit(1);
  if (!item) {
    throw new ApiError(404, "NOT_FOUND", "That file is not in this classroom");
  }
  if (
    item.uploadedByUserId !== actor.userId &&
    !canManageRecording(access.role)
  ) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher can remove another person's file");
  }
  await db.delete(files).where(eq(files.id, item.fileId));
  const deck = parseClassroomPresentation(row.presentation);
  if (deck?.fileId === item.fileId) {
    await replaceClassroomPresentation(row.id, actor.userId, null);
  }
  const shared: ClassroomSharedFile = {
    id: item.fileId,
    name: item.name?.trim() || "file",
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    userId: item.uploadedByUserId,
    displayName: displayNameOf(actor),
    role: access.role,
    createdAt: item.createdAt.toISOString(),
    href: classroomFileHref(row.id, item.fileId),
  };
  await fanoutClassroomFile(row.id, actor.userId, {
    action: "removed",
    file: shared,
  });
  return { ok: true as const, id: item.fileId };
}

async function fanoutClassroomPointer(
  classroomId: string,
  fromUserId: string,
  pointer: { x: number; y: number; color: string; pageId?: string },
) {
  const others = (await listClassroomPresence(classroomId))
    .filter((item) => item.userId !== fromUserId)
    .map((item) => item.userId);
  if (!others.length) return;
  await broadcastClassroomSignal(classroomId, others, {
    id: randomUUID(),
    type: "pointer",
    fromUserId,
    payload: pointer,
    createdAt: Date.now(),
  });
}

async function fanoutClassroomWhiteboard(
  classroomId: string,
  fromUserId: string,
  whiteboard: ClassroomWhiteboardDocument,
) {
  const others = (await listClassroomPresence(classroomId))
    .filter((item) => item.userId !== fromUserId)
    .map((item) => item.userId);
  if (!others.length) return;
  await broadcastClassroomSignal(classroomId, others, {
    id: randomUUID(),
    type: "whiteboard",
    fromUserId,
    payload: { whiteboard },
    createdAt: Date.now(),
  });
}

async function saveBoard(
  classroomId: string,
  fromUserId: string,
  whiteboard: ClassroomWhiteboardDocument,
) {
  await db
    .update(classrooms)
    .set({ whiteboard })
    .where(eq(classrooms.id, classroomId));
  await fanoutClassroomWhiteboard(classroomId, fromUserId, whiteboard);
  return { whiteboard };
}

function annotationBlockedMessage(role: ClassroomParticipantRole) {
  return role === "student"
    ? "The teacher paused student annotation"
    : "Parent observers can watch the board but cannot draw";
}

export async function updateClassroomWhiteboard(
  actor: ApiActor,
  classroomId: string,
  input: {
    stroke?: ClassroomWhiteboardStroke;
    pageId?: string;
    slideId?: string;
    clear?: boolean;
    undo?: boolean;
    redo?: boolean;
    addPage?: boolean;
    removePage?: boolean;
    removeIds?: string[];
    studentsCanAnnotate?: boolean;
    followPage?: boolean;
    annotateFileId?: string;
    pointer?: { x: number; y: number; color?: string; pageId?: string };
  },
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  const teacher = canManageRecording(access.role);
  const board = normalizeClassroomWhiteboard(row.whiteboard);
  const canDraw = classroomRoleCanAnnotate(access.role, board);

  if (input.studentsCanAnnotate !== undefined) {
    if (!teacher) {
      throw new ApiError(403, "FORBIDDEN", "Only the teacher can pause student annotation");
    }
    return saveBoard(
      row.id,
      actor.userId,
      setWhiteboardStudentsCanAnnotate(board, input.studentsCanAnnotate),
    );
  }

  if (input.slideId) {
    return annotateClassroomPresentation(actor, row.id, access.role, teacher, board, input);
  }

  if (input.followPage) {
    if (!teacher) {
      throw new ApiError(403, "FORBIDDEN", "Only the teacher can share the class page");
    }
    return saveBoard(row.id, actor.userId, setWhiteboardFollowPage(board, input.pageId));
  }

  if (input.annotateFileId) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", "Student annotation is paused, or observers cannot mark");
    }
    const file = await classroomStoredImage(row.id, input.annotateFileId);
    if (!file) {
      throw new ApiError(422, "VALIDATION", "Annotate a shared lesson image");
    }
    const next = annotateWhiteboardFile(board, input.annotateFileId, true);
    if (
      next.pages.length === board.pages.length &&
      !board.pages.some((page) => page.backgroundFileId === input.annotateFileId)
    ) {
      throw new ApiError(409, "LOCKED", "This lesson already has the maximum number of whiteboard pages");
    }
    return saveBoard(row.id, actor.userId, next);
  }

  if (input.pointer) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(access.role));
    }
    await fanoutClassroomPointer(row.id, actor.userId, {
      x: input.pointer.x,
      y: input.pointer.y,
      color: input.pointer.color ?? "#be123c",
      pageId: input.pointer.pageId ?? input.pageId,
    });
    return { whiteboard: board };
  }

  if (input.addPage) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(access.role));
    }
    const next = addWhiteboardPage(board, { share: teacher });
    if (next.pages.length === board.pages.length) {
      throw new ApiError(409, "LOCKED", "This lesson already has the maximum number of whiteboard pages");
    }
    return saveBoard(row.id, actor.userId, next);
  }

  if (input.removePage) {
    if (!teacher) {
      throw new ApiError(403, "FORBIDDEN", "Only the teacher can remove a whiteboard page");
    }
    return saveBoard(row.id, actor.userId, removeWhiteboardPage(board, input.pageId));
  }

  if (input.clear) {
    if (!teacher) {
      throw new ApiError(403, "FORBIDDEN", "Only the teacher can clear the board");
    }
    return saveBoard(row.id, actor.userId, clearWhiteboardPage(board, input.pageId, actor.userId));
  }

  if (input.undo) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(access.role));
    }
    return saveBoard(row.id, actor.userId, undoWhiteboard(board, input.pageId, actor.userId, teacher));
  }

  if (input.redo) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(access.role));
    }
    return saveBoard(row.id, actor.userId, redoWhiteboard(board, input.pageId, actor.userId, teacher));
  }

  if (input.removeIds?.length) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(access.role));
    }
    return saveBoard(
      row.id,
      actor.userId,
      removeWhiteboardStrokes(board, input.pageId, input.removeIds, actor.userId),
    );
  }

  if (!input.stroke) {
    throw new ApiError(400, "VALIDATION", "Add a stroke or update the board");
  }
  if (!canDraw) {
    throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(access.role));
  }
  const parsed = parseClassroomWhiteboardStroke({
    ...input.stroke,
    userId: actor.userId,
    role: parseClassroomAnnotatorRole(access.role),
    displayName: sanitizeClassroomAnnotatorName(displayNameOf(actor)),
  });
  if (!parsed) {
    throw new ApiError(400, "VALIDATION", "That whiteboard mark is not valid");
  }
  if (parsed.kind === "text") {
    const text = sanitizeClassroomWhiteboardText(parsed.text);
    if (!text) {
      throw new ApiError(400, "VALIDATION", "Write text for the board");
    }
    if (classroomContainsContactDetails(text)) {
      const { flagContactShare } = await import("@/server/communications/guard");
      await flagContactShare(actor, "whiteboard");
      throw new ApiError(
        422,
        "CONTACT_BLOCKED",
        "Keep phone numbers and personal accounts off the whiteboard",
      );
    }
    parsed.text = text;
    parsed.dir =
      parsed.dir === "ltr" || parsed.dir === "rtl"
        ? parsed.dir
        : detectClassroomTextDirection(text);
  }
  if (parsed.kind === "image") {
    if (!parsed.fileId) {
      throw new ApiError(400, "VALIDATION", "Choose an image for the board");
    }
    const page = whiteboardPageById(board, input.pageId);
    const images = (page?.strokes ?? []).filter(
      (stroke) => stroke.kind === "image" && stroke.id !== parsed.id,
    ).length;
    if (images >= CLASSROOM_MAX_BOARD_IMAGES) {
      throw new ApiError(409, "LOCKED", "This page already has the maximum number of images");
    }
    const file = await classroomStoredImage(row.id, parsed.fileId);
    if (!file) {
      throw new ApiError(422, "VALIDATION", "That image is not in this classroom");
    }
  }
  if (parsed.kind === "tajweed") {
    const rule = classroomTajweedRule(parsed.rule);
    if (!rule) {
      throw new ApiError(400, "VALIDATION", "Choose a Tajweed rule");
    }
    parsed.rule = rule.id;
    parsed.color = rule.color;
  }
  return saveBoard(row.id, actor.userId, addWhiteboardStroke(board, input.pageId, parsed, actor.userId));
}

async function annotateClassroomPresentation(
  actor: ApiActor,
  classroomId: string,
  role: ClassroomParticipantRole,
  teacher: boolean,
  board: ClassroomWhiteboardDocument,
  input: {
    stroke?: ClassroomWhiteboardStroke;
    pageId?: string;
    slideId?: string;
    clear?: boolean;
    undo?: boolean;
    redo?: boolean;
    addPage?: boolean;
    removePage?: boolean;
    removeIds?: string[];
    followPage?: boolean;
    annotateFileId?: string;
    pointer?: { x: number; y: number; color?: string; pageId?: string };
  },
) {
  const canDraw = classroomRoleCanAnnotate(role, board);
  const [row] = await db
    .select({ presentation: classrooms.presentation })
    .from(classrooms)
    .where(eq(classrooms.id, classroomId))
    .limit(1);
  const deck = parseClassroomPresentation(row?.presentation);
  if (!deck?.open) {
    throw new ApiError(400, "VALIDATION", "Start presenting before annotating slides");
  }
  const slideId = input.slideId ?? input.pageId;
  if (!slideId || !deck.slides.some((slide) => slide.id === slideId)) {
    throw new ApiError(400, "VALIDATION", "That slide is not in this presentation");
  }
  if (input.followPage || input.addPage || input.removePage || input.annotateFileId) {
    throw new ApiError(400, "VALIDATION", "Use the whiteboard for extra pages");
  }

  const slideBoard = presentationAsBoard(deck, classroomStudentsCanAnnotate(board));

  if (input.pointer) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(role));
    }
    await fanoutClassroomPointer(classroomId, actor.userId, {
      x: input.pointer.x,
      y: input.pointer.y,
      color: input.pointer.color ?? "#be123c",
      pageId: input.pointer.pageId ?? slideId,
    });
    return { whiteboard: board, presentation: deck };
  }

  if (input.clear) {
    if (!teacher) {
      throw new ApiError(403, "FORBIDDEN", "Only the teacher can clear slide marks");
    }
    return savePresentation(
      classroomId,
      actor.userId,
      boardOntoPresentation(
        deck,
        clearWhiteboardPage(slideBoard, slideId, actor.userId),
      ),
    ).then((result) => ({ whiteboard: board, presentation: result.presentation }));
  }

  if (input.undo) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(role));
    }
    return savePresentation(
      classroomId,
      actor.userId,
      boardOntoPresentation(
        deck,
        undoWhiteboard(slideBoard, slideId, actor.userId, teacher),
      ),
    ).then((result) => ({ whiteboard: board, presentation: result.presentation }));
  }

  if (input.redo) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(role));
    }
    return savePresentation(
      classroomId,
      actor.userId,
      boardOntoPresentation(
        deck,
        redoWhiteboard(slideBoard, slideId, actor.userId, teacher),
      ),
    ).then((result) => ({ whiteboard: board, presentation: result.presentation }));
  }

  if (input.removeIds?.length) {
    if (!canDraw) {
      throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(role));
    }
    return savePresentation(
      classroomId,
      actor.userId,
      boardOntoPresentation(
        deck,
        removeWhiteboardStrokes(slideBoard, slideId, input.removeIds, actor.userId),
      ),
    ).then((result) => ({ whiteboard: board, presentation: result.presentation }));
  }

  if (!input.stroke) {
    throw new ApiError(400, "VALIDATION", "Add a mark on this slide");
  }
  if (!canDraw) {
    throw new ApiError(403, "FORBIDDEN", annotationBlockedMessage(role));
  }
  const parsed = parseClassroomWhiteboardStroke({
    ...input.stroke,
    userId: actor.userId,
    role: parseClassroomAnnotatorRole(role),
    displayName: sanitizeClassroomAnnotatorName(displayNameOf(actor)),
  });
  if (!parsed) {
    throw new ApiError(400, "VALIDATION", "That slide mark is not valid");
  }
  if (parsed.kind === "text") {
    const text = sanitizeClassroomWhiteboardText(parsed.text);
    if (!text) {
      throw new ApiError(400, "VALIDATION", "Write text for the slide");
    }
    if (classroomContainsContactDetails(text)) {
      const { flagContactShare } = await import("@/server/communications/guard");
      await flagContactShare(actor, "whiteboard");
      throw new ApiError(
        422,
        "CONTACT_BLOCKED",
        "Keep phone numbers and personal accounts off the whiteboard",
      );
    }
    parsed.text = text;
    parsed.dir =
      parsed.dir === "ltr" || parsed.dir === "rtl"
        ? parsed.dir
        : detectClassroomTextDirection(text);
  }
  if (parsed.kind === "image") {
    if (!parsed.fileId) {
      throw new ApiError(400, "VALIDATION", "Choose an image for the slide");
    }
    const page = whiteboardPageById(slideBoard, slideId);
    const images = (page?.strokes ?? []).filter(
      (stroke) => stroke.kind === "image" && stroke.id !== parsed.id,
    ).length;
    if (images >= CLASSROOM_MAX_BOARD_IMAGES) {
      throw new ApiError(409, "LOCKED", "This slide already has the maximum number of images");
    }
    const file = await classroomStoredImage(classroomId, parsed.fileId);
    if (!file) {
      throw new ApiError(422, "VALIDATION", "That image is not in this classroom");
    }
  }
  if (parsed.kind === "tajweed") {
    const rule = classroomTajweedRule(parsed.rule);
    if (!rule) {
      throw new ApiError(400, "VALIDATION", "Choose a Tajweed rule");
    }
    parsed.rule = rule.id;
    parsed.color = rule.color;
  }
  const presentation = boardOntoPresentation(
    deck,
    addWhiteboardStroke(slideBoard, slideId, parsed, actor.userId),
  );
  await savePresentation(classroomId, actor.userId, presentation);
  return { whiteboard: board, presentation };
}

export async function updateClassroomPresentation(
  actor: ApiActor,
  classroomId: string,
  input: {
    action: "open" | "close" | "goto" | "bookmark" | "lock";
    fileId?: string;
    slideIndex?: number;
    followLocked?: boolean;
  },
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  if (!canManageRecording(access.role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher can present slides");
  }
  const current = parseClassroomPresentation(row.presentation);

  if (input.action === "close") {
    if (!current) return { presentation: null };
    return savePresentation(row.id, actor.userId, { ...current, open: false });
  }

  if (input.action === "goto") {
    if (!current?.open) {
      throw new ApiError(400, "VALIDATION", "Start presenting before changing slides");
    }
    const slideIndex = Math.max(
      0,
      Math.min(current.slides.length - 1, input.slideIndex ?? current.slideIndex),
    );
    return savePresentation(row.id, actor.userId, { ...current, slideIndex });
  }

  if (input.action === "bookmark") {
    if (!current?.open) {
      throw new ApiError(400, "VALIDATION", "Start presenting before bookmarking a page");
    }
    return savePresentation(row.id, actor.userId, {
      ...current,
      bookmarks: toggleClassroomBookmark(
        current,
        input.slideIndex ?? current.slideIndex,
      ),
    });
  }

  if (input.action === "lock") {
    if (!current?.open) {
      throw new ApiError(400, "VALIDATION", "Start presenting before locking pages");
    }
    return savePresentation(row.id, actor.userId, {
      ...current,
      followLocked: input.followLocked ?? !current.followLocked,
    });
  }

  const fileId = input.fileId ?? current?.fileId;
  if (!fileId) {
    throw new ApiError(400, "VALIDATION", "Choose a presentation to open");
  }
  const [item] = await db
    .select({
      fileId: classroomFiles.fileId,
      name: files.originalName,
      mimeType: files.mimeType,
    })
    .from(classroomFiles)
    .innerJoin(files, eq(files.id, classroomFiles.fileId))
    .where(
      and(eq(classroomFiles.classroomId, row.id), eq(classroomFiles.fileId, fileId)),
    )
    .limit(1);
  if (!item || !isClassroomPresentableType(item.mimeType)) {
    throw new ApiError(422, "VALIDATION", "Present a PowerPoint, PDF, or digital book from this lesson");
  }
  const name = item.name?.trim() || (isClassroomPptxType(item.mimeType) ? "Presentation" : "Book");
  const kind = presentableKind(item.mimeType);
  if (current?.fileId === fileId && current.kind === kind && current.slides.length) {
    return savePresentation(row.id, actor.userId, { ...current, open: true });
  }
  const stored = await classroomStoredFile(row.id, fileId);
  if (!stored?.content) {
    throw new ApiError(404, "NOT_FOUND", "That file is not in this classroom");
  }
  let parsed;
  try {
    parsed = parseClassroomBook(item.mimeType, stored.content);
  } catch (error) {
    throw new ApiError(
      422,
      "VALIDATION",
      error instanceof Error ? error.message : presentableParseError(item.mimeType),
    );
  }
  return replaceClassroomPresentation(row.id, actor.userId, {
    fileId,
    name,
    kind: parsed.kind,
    slideIndex: 0,
    open: true,
    slides: await storePresentationSlides(row.id, actor.userId, parsed.slides),
  });
}

function presentableKind(mimeType: string): "pptx" | "pdf" | "epub" {
  if (isClassroomEpubType(mimeType)) return "epub";
  if (mimeType === "application/pdf") return "pdf";
  return "pptx";
}

function parseClassroomBook(mimeType: string, bytes: Buffer) {
  if (isClassroomPptxType(mimeType)) {
    return { kind: "pptx" as const, slides: parsePptxSlides(bytes) };
  }
  if (mimeType === "application/pdf") {
    return { kind: "pdf" as const, slides: parsePdfPages(bytes) };
  }
  if (isClassroomEpubType(mimeType)) {
    return { kind: "epub" as const, slides: parseEpubPages(bytes) };
  }
  throw new Error("Present a PowerPoint, PDF, or digital book from this lesson");
}

function presentableParseError(mimeType: string) {
  if (isClassroomEpubType(mimeType)) return "That digital book has no readable pages";
  if (mimeType === "application/pdf") return "That PDF has no readable pages";
  return "That PowerPoint file has no readable slides";
}

export async function controlClassroomMedia(
  actor: ApiActor,
  classroomId: string,
  input: { targetUserId: string; action: "mute" | "camera_off" | "screen_off" },
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  if (!canManageRecording(access.role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher can control cameras, microphones, and screen sharing");
  }
  if (input.targetUserId === actor.userId) {
    throw new ApiError(400, "VALIDATION", "Use your own camera and microphone controls");
  }
  const presence = await listClassroomPresence(row.id);
  const target = presence.find((item) => item.userId === input.targetUserId);
  if (!target) {
    throw new ApiError(404, "NOT_FOUND", "That person is not in the classroom");
  }
  if (target.role === "teacher") {
    throw new ApiError(403, "FORBIDDEN", "The teacher camera and microphone cannot be controlled");
  }
  await enqueueClassroomSignal(row.id, {
    id: randomUUID(),
    type: "control",
    fromUserId: actor.userId,
    toUserId: input.targetUserId,
    payload: { action: input.action },
    createdAt: Date.now(),
  });
  return { ok: true as const };
}

export async function postClassroomSignal(
  actor: ApiActor,
  classroomId: string,
  input: { type: ClassroomSignal["type"]; toUserId: string; payload: unknown },
) {
  const { row } = await requireLiveClassroom(actor, classroomId);
  if (input.type === "control") {
    throw new ApiError(403, "FORBIDDEN", "Use classroom media controls");
  }
  if (input.type === "chat") {
    throw new ApiError(403, "FORBIDDEN", "Use classroom text chat");
  }
  if (input.type === "file") {
    throw new ApiError(403, "FORBIDDEN", "Use classroom file sharing");
  }
  if (input.type === "whiteboard") {
    throw new ApiError(403, "FORBIDDEN", "Use the classroom whiteboard");
  }
  if (input.type === "pointer") {
    throw new ApiError(403, "FORBIDDEN", "Use the classroom whiteboard");
  }
  if (input.type === "presentation") {
    throw new ApiError(403, "FORBIDDEN", "Use the classroom presentation");
  }
  if (input.type === "recording") {
    throw new ApiError(403, "FORBIDDEN", "Use classroom recording");
  }
  if (input.toUserId === actor.userId) {
    throw new ApiError(400, "VALIDATION", "Cannot signal yourself");
  }
  const signal: ClassroomSignal = {
    id: randomUUID(),
    type: input.type,
    fromUserId: actor.userId,
    toUserId: input.toUserId,
    payload: input.payload,
    createdAt: Date.now(),
  };
  await enqueueClassroomSignal(row.id, signal);
  return { ok: true as const };
}

export async function setClassroomRecording(
  actor: ApiActor,
  classroomId: string,
  action: "start" | "stop",
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  if (!canManageRecording(access.role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher can control recording");
  }
  const current = await activeRecording(row.id);
  if (action === "start") {
    if (current) {
      if (!current.storageKey) {
        await attachRecordingFile(row.id, current.id, actor.userId);
      }
      const view = toRecordingView(current);
      await fanoutClassroomRecording(row.id, actor.userId, view);
      return view;
    }
    const [saved] = await db
      .insert(recordings)
      .values({
        classroomId: row.id,
        startedByUserId: actor.userId,
        status: "recording",
      })
      .returning();
    await attachRecordingFile(row.id, saved.id, actor.userId);
    await db
      .update(classrooms)
      .set({ recordingEnabled: true })
      .where(eq(classrooms.id, row.id));
    const view = toRecordingView(saved);
    await fanoutClassroomRecording(row.id, actor.userId, view);
    return view;
  }
  if (!current) {
    return null;
  }
  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - current.startedAt.getTime()) / 1000),
  );
  let byteSize = 0;
  if (current.storageKey) {
    const [file] = await db
      .select({ byteSize: files.byteSize })
      .from(files)
      .where(eq(files.storageKey, current.storageKey))
      .limit(1);
    byteSize = file?.byteSize ?? 0;
  }
  const [saved] = await db
    .update(recordings)
    .set({
      status: byteSize > 0 ? "ready" : "failed",
      endedAt,
      durationSeconds,
    })
    .where(eq(recordings.id, current.id))
    .returning();
  await db
    .update(classrooms)
    .set({ recordingEnabled: false })
    .where(eq(classrooms.id, row.id));
  await fanoutClassroomRecording(row.id, actor.userId, null);
  return toRecordingView(saved);
}

export async function appendClassroomRecordingChunk(
  actor: ApiActor,
  classroomId: string,
  input: { recordingId: string; bytes: Buffer; mimeType?: string },
) {
  const { row, access } = await requireLiveClassroom(actor, classroomId);
  if (!canManageRecording(access.role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher can record this lesson");
  }
  const current = await activeRecording(row.id);
  if (!current || current.id !== input.recordingId) {
    throw new ApiError(409, "RECORDING_INACTIVE", "This recording is not active");
  }
  if (!input.bytes.byteLength) {
    throw new ApiError(400, "VALIDATION", "Recording chunk is empty");
  }
  if (input.bytes.byteLength > CLASSROOM_RECORDING_CHUNK_MAX_BYTES) {
    throw new ApiError(400, "VALIDATION", "Recording chunk is too large");
  }
  const storageKey =
    current.storageKey ?? (await attachRecordingFile(row.id, current.id, actor.userId));
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.storageKey, storageKey))
    .limit(1);
  if (!file) {
    throw new ApiError(404, "NOT_FOUND", "Recording file is missing");
  }
  if (file.byteSize + input.bytes.byteLength > CLASSROOM_MAX_RECORDING_BYTES) {
    throw new ApiError(400, "RECORDING_LIMIT", "This recording has reached the size limit");
  }
  const [object] = await db
    .select()
    .from(fileObjects)
    .where(eq(fileObjects.fileId, file.id))
    .limit(1);
  const next = appendSecureRecordingChunk(
    object?.content ?? emptySecureRecordingEnvelope(),
    input.bytes,
  );
  if (object) {
    await db
      .update(fileObjects)
      .set({ content: next })
      .where(eq(fileObjects.fileId, file.id));
  } else {
    await db.insert(fileObjects).values({ fileId: file.id, content: next });
  }
  const mime = input.mimeType?.split(";")[0]?.trim();
  await db
    .update(files)
    .set({
      byteSize: next.byteLength,
      ...(file.byteSize === 0 && mime ? { mimeType: mime } : {}),
    })
    .where(eq(files.id, file.id));
  return { id: current.id, bytes: next.byteLength };
}

export function assertClassroomToken(
  token: string | null | undefined,
  classroomId: string,
  userId: string,
) {
  if (!verifyClassroomJoinToken(token, classroomId, userId)) {
    throw new ApiError(401, "CLASSROOM_TOKEN", "Classroom join token is invalid");
  }
}
