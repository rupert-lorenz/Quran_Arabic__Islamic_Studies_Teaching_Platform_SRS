import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  groupLessonEnrollments,
  groupLessons,
  liveCourseEnrollments,
  liveCourses,
  parentChildren,
  roles,
  secureMessages,
  secureThreads,
  teacherProfiles,
  users,
} from "@/db/schema";
import { classroomContainsContactDetails } from "@/lib/classroom";
import { isStaffRole } from "@/lib/rbac";
import {
  channelsForRole,
  orderedPair,
  type SecureMessageChannel,
} from "@/lib/secure-messages";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type { SendSecureMessageInput } from "./schemas";

type Person = {
  userId: string;
  displayName: string;
  roleKey: string;
};

const STAFF = [
  "super_admin",
  "admin",
  "accounts",
  "marketing",
  "academic",
  "safeguarding",
] as const;

async function loadPerson(userId: string): Promise<Person | null> {
  const [row] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      roleKey: roles.key,
      status: users.status,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!row || row.status === "suspended") return null;
  return {
    userId: row.userId,
    displayName: row.displayName,
    roleKey: row.roleKey,
  };
}

async function studentIdsForTeacher(teacherUserId: string) {
  const [lessonRows, groupRows, courseRows] = await Promise.all([
    db
      .select({ id: bookings.studentUserId })
      .from(bookings)
      .where(eq(bookings.teacherUserId, teacherUserId)),
    db
      .select({ id: groupLessonEnrollments.studentUserId })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(eq(groupLessons.teacherUserId, teacherUserId)),
    db
      .select({ id: liveCourseEnrollments.studentUserId })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(eq(liveCourses.teacherUserId, teacherUserId)),
  ]);
  return [...new Set([...lessonRows, ...groupRows, ...courseRows].map((row) => row.id))];
}

async function teacherIdsForStudents(studentIds: string[]) {
  if (!studentIds.length) return [];
  const [lessonRows, groupRows, courseRows] = await Promise.all([
    db
      .select({ id: bookings.teacherUserId })
      .from(bookings)
      .where(inArray(bookings.studentUserId, studentIds)),
    db
      .select({ id: groupLessons.teacherUserId })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(inArray(groupLessonEnrollments.studentUserId, studentIds)),
    db
      .select({ id: liveCourses.teacherUserId })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(inArray(liveCourseEnrollments.studentUserId, studentIds)),
  ]);
  return [...new Set([...lessonRows, ...groupRows, ...courseRows].map((row) => row.id))];
}

async function peopleByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(inArray(users.id, ids), isNull(users.deletedAt), eq(users.status, "active")))
    .orderBy(users.displayName);
  return rows;
}

async function staffPeople() {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        inArray(roles.key, [...STAFF]),
        isNull(users.deletedAt),
        eq(users.status, "active"),
      ),
    )
    .orderBy(users.displayName)
    .limit(40);
  return rows;
}

async function teacherApproved(userId: string) {
  const [row] = await db
    .select({ status: teacherProfiles.verificationStatus })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);
  return row?.status === "approved";
}

async function contactsFor(actor: ApiActor) {
  const staff = await staffPeople();
  if (actor.roleKey === "teacher") {
    const studentIds = await studentIdsForTeacher(actor.userId);
    const students = await peopleByIds(studentIds);
    const parentRows = studentIds.length
      ? await db
          .select({ id: parentChildren.parentUserId })
          .from(parentChildren)
          .where(inArray(parentChildren.childUserId, studentIds))
      : [];
    const parents = await peopleByIds([...new Set(parentRows.map((row) => row.id))]);
    return {
      teacher_student: students.filter((row) => row.roleKey === "student"),
      teacher_parent: parents.filter((row) => row.roleKey === "parent"),
      teacher_admin: staff.filter((row) => row.userId !== actor.userId),
      family_admin: [] as Person[],
    };
  }
  if (actor.roleKey === "parent") {
    const childRows = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    const teachers = await peopleByIds(
      await teacherIdsForStudents(childRows.map((row) => row.id)),
    );
    return {
      teacher_student: [] as Person[],
      teacher_parent: teachers.filter((row) => row.roleKey === "teacher"),
      teacher_admin: [] as Person[],
      family_admin: staff,
    };
  }
  if (actor.roleKey === "student") {
    const teachers = await peopleByIds(await teacherIdsForStudents([actor.userId]));
    return {
      teacher_student: teachers.filter((row) => row.roleKey === "teacher"),
      teacher_parent: [] as Person[],
      teacher_admin: [] as Person[],
      family_admin: staff,
    };
  }
  if (!isStaffRole(actor.roleKey)) {
    return {
      teacher_student: [] as Person[],
      teacher_parent: [] as Person[],
      teacher_admin: [] as Person[],
      family_admin: [] as Person[],
    };
  }
  const [teacherRows, familyRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        displayName: users.displayName,
        roleKey: roles.key,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(
        and(eq(roles.key, "teacher"), isNull(users.deletedAt), eq(users.status, "active")),
      )
      .orderBy(users.displayName)
      .limit(40),
    db
      .select({
        userId: users.id,
        displayName: users.displayName,
        roleKey: roles.key,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(
        and(
          inArray(roles.key, ["parent", "student"]),
          isNull(users.deletedAt),
          eq(users.status, "active"),
        ),
      )
      .orderBy(users.displayName)
      .limit(40),
  ]);
  return {
    teacher_student: [] as Person[],
    teacher_parent: [] as Person[],
    teacher_admin: teacherRows,
    family_admin: familyRows,
  };
}

async function assertPair(actor: ApiActor, channel: SecureMessageChannel, other: Person) {
  if (!channelsForRole(actor.roleKey).includes(channel)) {
    throw new ApiError(403, "FORBIDDEN", "That conversation is not available for this account");
  }
  if (other.userId === actor.userId) {
    throw new ApiError(422, "VALIDATION", "Choose someone else");
  }
  const actorIsStaff = isStaffRole(actor.roleKey);
  const otherIsStaff = isStaffRole(other.roleKey);

  if (channel === "teacher_student") {
    const teacherId = actor.roleKey === "teacher" ? actor.userId : other.userId;
    const studentId = actor.roleKey === "student" ? actor.userId : other.userId;
    if (
      ![actor.roleKey, other.roleKey].includes("teacher") ||
      ![actor.roleKey, other.roleKey].includes("student")
    ) {
      throw new ApiError(403, "FORBIDDEN", "This conversation is only for a teacher and a student");
    }
    if (!(await teacherApproved(teacherId))) {
      throw new ApiError(403, "FORBIDDEN", "That teacher is not approved yet");
    }
    const students = await studentIdsForTeacher(teacherId);
    if (!students.includes(studentId)) {
      throw new ApiError(403, "FORBIDDEN", "Message a student you teach");
    }
    return;
  }

  if (channel === "teacher_parent") {
    const teacherId = actor.roleKey === "teacher" ? actor.userId : other.userId;
    const parentId = actor.roleKey === "parent" ? actor.userId : other.userId;
    if (
      ![actor.roleKey, other.roleKey].includes("teacher") ||
      ![actor.roleKey, other.roleKey].includes("parent")
    ) {
      throw new ApiError(403, "FORBIDDEN", "This conversation is only for a teacher and a parent");
    }
    if (!(await teacherApproved(teacherId))) {
      throw new ApiError(403, "FORBIDDEN", "That teacher is not approved yet");
    }
    const studentIds = await studentIdsForTeacher(teacherId);
    if (!studentIds.length) {
      throw new ApiError(403, "FORBIDDEN", "Message a parent whose child you teach");
    }
    const [link] = await db
      .select({ id: parentChildren.parentUserId })
      .from(parentChildren)
      .where(
        and(
          eq(parentChildren.parentUserId, parentId),
          inArray(parentChildren.childUserId, studentIds),
        ),
      )
      .limit(1);
    if (!link) {
      throw new ApiError(403, "FORBIDDEN", "Message a parent whose child you teach");
    }
    return;
  }

  if (channel === "teacher_admin") {
    const teacher = actor.roleKey === "teacher" ? actor : other.roleKey === "teacher" ? other : null;
    const staffSide = actorIsStaff ? actor : otherIsStaff ? other : null;
    if (!teacher || !staffSide) {
      throw new ApiError(403, "FORBIDDEN", "This conversation is only for a teacher and an admin");
    }
    return;
  }

  const family =
    actor.roleKey === "parent" || actor.roleKey === "student"
      ? actor
      : other.roleKey === "parent" || other.roleKey === "student"
        ? other
        : null;
  const staffSide = actorIsStaff ? actor : otherIsStaff ? other : null;
  if (!family || !staffSide) {
    throw new ApiError(403, "FORBIDDEN", "This conversation is only for a student or parent and an admin");
  }
}

export async function getSecureInbox(actor: ApiActor) {
  const contacts = await contactsFor(actor);
  const threads = await db
    .select({
      id: secureThreads.id,
      channel: secureThreads.channel,
      participantLow: secureThreads.participantLow,
      participantHigh: secureThreads.participantHigh,
      updatedAt: secureThreads.updatedAt,
    })
    .from(secureThreads)
    .where(
      or(
        eq(secureThreads.participantLow, actor.userId),
        eq(secureThreads.participantHigh, actor.userId),
      ),
    )
    .orderBy(desc(secureThreads.updatedAt))
    .limit(40);

  const threadIds = threads.map((row) => row.id);
  const messageRows = threadIds.length
    ? await db
        .select({
          id: secureMessages.id,
          threadId: secureMessages.threadId,
          senderUserId: secureMessages.senderUserId,
          body: secureMessages.body,
          createdAt: secureMessages.createdAt,
        })
        .from(secureMessages)
        .where(inArray(secureMessages.threadId, threadIds))
        .orderBy(desc(secureMessages.createdAt))
        .limit(240)
    : [];

  const otherIds = threads.map((row) =>
    row.participantLow === actor.userId ? row.participantHigh : row.participantLow,
  );
  const people = await peopleByIds([...new Set(otherIds)]);
  const byId = new Map(people.map((row) => [row.userId, row]));

  return {
    channels: channelsForRole(actor.roleKey),
    contacts,
    threads: threads.map((row) => {
      const otherId =
        row.participantLow === actor.userId ? row.participantHigh : row.participantLow;
      const other = byId.get(otherId);
      const messages = messageRows
        .filter((item) => item.threadId === row.id)
        .sort((a, b) => +a.createdAt - +b.createdAt)
        .slice(-30)
        .map((item) => ({
          id: item.id,
          senderUserId: item.senderUserId,
          mine: item.senderUserId === actor.userId,
          body: item.body,
          createdAt: item.createdAt.toISOString(),
        }));
      return {
        id: row.id,
        channel: row.channel,
        otherUserId: otherId,
        otherName: other?.displayName ?? "Account",
        otherRole: other?.roleKey ?? "",
        updatedAt: row.updatedAt.toISOString(),
        preview: messages.at(-1)?.body ?? "",
        messages,
      };
    }),
  };
}

export async function sendSecureMessage(
  actor: ApiActor,
  input: SendSecureMessageInput,
  ip: string,
) {
  if (classroomContainsContactDetails(input.body)) {
    const { flagContactShare } = await import("@/server/communications/guard");
    await flagContactShare(actor, "messages");
    throw new ApiError(
      422,
      "CONTACT_BLOCKED",
      "Keep phone numbers and personal accounts off the message",
    );
  }
  const other = await loadPerson(input.recipientUserId);
  if (!other) {
    throw new ApiError(404, "NOT_FOUND", "That account is not available");
  }
  await assertPair(actor, input.channel, other);
  const [low, high] = orderedPair(actor.userId, other.userId);
  const [existing] = await db
    .select({ id: secureThreads.id })
    .from(secureThreads)
    .where(
      and(
        eq(secureThreads.channel, input.channel),
        eq(secureThreads.participantLow, low),
        eq(secureThreads.participantHigh, high),
      ),
    )
    .limit(1);
  const threadId =
    existing?.id ??
    (
      await db
        .insert(secureThreads)
        .values({
          channel: input.channel,
          participantLow: low,
          participantHigh: high,
        })
        .returning({ id: secureThreads.id })
    )[0]?.id;
  if (!threadId) {
    throw new ApiError(500, "INTERNAL", "Could not open the conversation");
  }
  await db.insert(secureMessages).values({
    threadId,
    senderUserId: actor.userId,
    body: input.body,
  });
  await db
    .update(secureThreads)
    .set({ updatedAt: new Date() })
    .where(eq(secureThreads.id, threadId));
  await writeAuditLog({
    actor,
    action: "secure_message.sent",
    entityType: "secure_thread",
    entityId: threadId,
    ipAddress: ip,
    metadata: { channel: input.channel },
  });
  return getSecureInbox(actor);
}
