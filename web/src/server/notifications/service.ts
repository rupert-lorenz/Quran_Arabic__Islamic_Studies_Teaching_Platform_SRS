import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  groupLessonEnrollments,
  groupLessons,
  studentProfiles,
  userNotifications,
  users,
} from "@/db/schema";
import { formatInTimeZone } from "@/lib/timezone";
import { publicGroupClassHref } from "@/lib/booking";
import { sendAccountEmail } from "@/server/auth/mail";
import { getConfig } from "@/server/config";
import type { ApiActor } from "@/server/api/auth";

export type UserNotificationView = {
  id: string;
  kind: "group_place_reserved" | "group_place_available";
  title: string;
  body: string;
  href: string;
  studentName?: string;
  classTitle?: string;
  whenLabel?: string;
  readAt: string | null;
  createdAt: string;
};

function toView(
  row: typeof userNotifications.$inferSelect,
): UserNotificationView {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    studentName:
      typeof metadata.studentName === "string" ? metadata.studentName : undefined,
    classTitle:
      typeof metadata.classTitle === "string" ? metadata.classTitle : undefined,
    whenLabel:
      typeof metadata.whenLabel === "string" ? metadata.whenLabel : undefined,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function recipientUserIds(input: {
  studentUserId: string;
  bookedByUserId: string;
}) {
  const ids = new Set<string>([input.bookedByUserId]);
  if (input.studentUserId !== input.bookedByUserId) {
    const [student] = await db
      .select({ parentManaged: studentProfiles.parentManaged })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, input.studentUserId))
      .limit(1);
    if (student && !student.parentManaged) {
      ids.add(input.studentUserId);
    }
  }
  return [...ids];
}

async function writeNotifications(input: {
  userIds: string[];
  kind: UserNotificationView["kind"];
  title: string;
  body: string;
  href: string;
  metadata: Record<string, unknown>;
}) {
  const uniqueIds = [...new Set(input.userIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  const saved = await db
    .insert(userNotifications)
    .values(
      uniqueIds.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
        metadata: input.metadata,
      })),
    )
    .returning({ id: userNotifications.id, userId: userNotifications.userId });
  const recipients = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, uniqueIds));
  await Promise.all(
    recipients.map((user) =>
      user.email
        ? sendAccountEmail({
            to: user.email,
            subject: input.title,
            text: `${input.body}\n\n${getConfig().APP_URL}${input.href}`,
          }).catch((error) => {
            console.error("notification_email_failed", {
              userId: user.id,
              error: error instanceof Error ? error.message : "unknown",
            });
          })
        : Promise.resolve(),
    ),
  );
  return saved;
}

export async function listActorNotifications(actor: ApiActor) {
  const rows = await db
    .select()
    .from(userNotifications)
    .where(eq(userNotifications.userId, actor.userId))
    .orderBy(desc(userNotifications.createdAt))
    .limit(20);
  return {
    unreadCount: rows.filter((row) => !row.readAt).length,
    notifications: rows.map(toView),
  };
}

export async function countUnreadNotifications(userId: string) {
  const rows = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(
      and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)),
    )
    .limit(50);
  return rows.length;
}

export async function markNotificationRead(actor: ApiActor, notificationId: string) {
  const [row] = await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotifications.id, notificationId),
        eq(userNotifications.userId, actor.userId),
      ),
    )
    .returning();
  return row ? toView(row) : null;
}

export async function markAllNotificationsRead(actor: ApiActor) {
  await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotifications.userId, actor.userId),
        isNull(userNotifications.readAt),
      ),
    );
  return listActorNotifications(actor);
}

export async function notifyGroupPlaceReserved(enrollmentId: string) {
  const [row] = await db
    .select({
      enrollment: groupLessonEnrollments,
      lessonTitle: groupLessons.title,
      lessonId: groupLessons.id,
      seriesId: groupLessons.seriesId,
      startsAt: groupLessons.startsAt,
      timezone: groupLessons.timezone,
      studentName: users.displayName,
    })
    .from(groupLessonEnrollments)
    .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
    .innerJoin(users, eq(users.id, groupLessonEnrollments.studentUserId))
    .where(eq(groupLessonEnrollments.id, enrollmentId))
    .limit(1);
  if (!row) return;
  const whenLabel = formatInTimeZone(row.startsAt, row.timezone);
  const href = `${publicGroupClassHref({
    id: row.lessonId,
    seriesId: row.seriesId,
  })}#group-${row.enrollment.groupLessonId}`;
  const title = "A group-class place is reserved";
  const body = `A place is now reserved for ${row.studentName} in ${row.lessonTitle} on ${whenLabel}.`;
  await writeNotifications({
    userIds: await recipientUserIds({
      studentUserId: row.enrollment.studentUserId,
      bookedByUserId: row.enrollment.bookedByUserId,
    }),
    kind: "group_place_reserved",
    title,
    body,
    href,
    metadata: {
      groupLessonId: row.enrollment.groupLessonId,
      enrollmentId,
      studentName: row.studentName,
      classTitle: row.lessonTitle,
      whenLabel,
    },
  });
}

export async function notifyGroupPlaceAvailable(groupLessonId: string) {
  const [lesson] = await db
    .select({
      id: groupLessons.id,
      seriesId: groupLessons.seriesId,
      title: groupLessons.title,
      startsAt: groupLessons.startsAt,
      timezone: groupLessons.timezone,
    })
    .from(groupLessons)
    .where(eq(groupLessons.id, groupLessonId))
    .limit(1);
  if (!lesson) return;
  const waiting = await db
    .select({
      studentUserId: groupLessonEnrollments.studentUserId,
      bookedByUserId: groupLessonEnrollments.bookedByUserId,
    })
    .from(groupLessonEnrollments)
    .where(
      and(
        eq(groupLessonEnrollments.groupLessonId, groupLessonId),
        eq(groupLessonEnrollments.status, "waitlisted"),
      ),
    );
  if (!waiting.length) return;
  const whenLabel = formatInTimeZone(lesson.startsAt, lesson.timezone);
  const href = `${publicGroupClassHref(lesson)}#group-${lesson.id}`;
  const userIds = (
    await Promise.all(waiting.map((row) => recipientUserIds(row)))
  ).flat();
  await writeNotifications({
    userIds,
    kind: "group_place_available",
    title: "A group-class place is available",
    body: `A place is now available in ${lesson.title} on ${whenLabel}. Open the class to reserve it.`,
    href,
    metadata: {
      groupLessonId: lesson.id,
      classTitle: lesson.title,
      whenLabel,
    },
  });
}
