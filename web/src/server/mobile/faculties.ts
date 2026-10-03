import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  classroomParticipants,
  classrooms,
  financeOperations,
  homeworkWork,
  homeworks,
  islamicProgress,
  lessonHistory,
  mobileDevices,
  recordings,
  secureThreads,
  teacherProfiles,
  teachingMaterials,
  userNotifications,
  users,
} from "@/db/schema";
import { ANDROID_PACKAGE, IOS_BUNDLE_ID } from "@/lib/mobile";
import type { ApiActor } from "@/server/api/auth";
import { bookingScope, childIdsFor, crmFlags } from "@/server/crm/scope";

function when(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function hrefs(flags: ReturnType<typeof crmFlags>) {
  return {
    search: "/teachers",
    booking: flags.staff
      ? "/staff/bookings"
      : flags.teacher
        ? "/teach/bookings"
        : flags.student
          ? "/learn/bookings"
          : "/family/bookings",
    payments: flags.staff
      ? "/staff/finance"
      : flags.teacher
        ? "/teach/earnings"
        : flags.parent
          ? "/family/wallet"
          : "/learn/bookings",
    classroom: "/classroom/join",
    messages: "/messages",
    homework: flags.teacher
      ? "/teach/homework"
      : flags.student
        ? "/learn/homework"
        : flags.staff
          ? "/staff/academic"
          : "/family/homework",
    reports: flags.teacher
      ? "/teach/reports"
      : flags.student
        ? "/learn/reports"
        : flags.staff
          ? "/staff/academic/reports"
          : "/family/progress",
    progress: flags.teacher
      ? "/teach/progress"
      : flags.student
        ? "/learn/progress"
        : flags.parent
          ? "/family/progress"
          : "/staff/academic",
    notifications: "/account",
    recordings: flags.teacher
      ? "/teach/video"
      : flags.staff
        ? "/staff/safeguarding"
        : "/classroom/join",
    materials: flags.teacher
      ? "/teach/library"
      : flags.student
        ? "/learn/library"
        : flags.parent
          ? "/family/library"
          : "/library",
    apps: "/mobile",
  };
}

export async function getMobileFaculties(actor: ApiActor) {
  const flags = crmFlags(actor);
  const [childIds, scope] = await Promise.all([
    flags.parent ? childIdsFor(actor.userId) : Promise.resolve([]),
    bookingScope(actor),
  ]);
  const learnerIds = flags.staff
    ? null
    : flags.student
      ? [actor.userId]
      : flags.parent
        ? childIds
        : flags.teacher
          ? (
              await db
                .selectDistinct({ id: bookings.studentUserId })
                .from(bookings)
                .where(eq(bookings.teacherUserId, actor.userId))
            ).map((row) => row.id)
          : [];

  const people = (column: AnyColumn) => {
    if (learnerIds === null) return sql`true`;
    if (!learnerIds.length) return sql`false`;
    return inArray(column, learnerIds);
  };

  const bookingWhere = scope ?? (flags.staff ? undefined : sql`false`);
  const chargeWhere = bookingWhere
    ? and(bookingWhere, ne(bookings.status, "cancelled"))
    : ne(bookings.status, "cancelled");

  const [
    teacherRows,
    deviceRows,
    allDeviceRows,
    bookingRows,
    chargeRows,
    payoutRows,
    classroomRows,
    messageRows,
    homeworkRows,
    reportRows,
    progressRows,
    notificationRows,
    unreadRows,
    recordingRows,
    materialRows,
    ownMaterialRows,
    bookingList,
    classroomList,
    messageList,
    homeworkList,
    reportList,
    progressList,
    notificationList,
    recordingList,
    materialList,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(teacherProfiles)
      .innerJoin(users, eq(users.id, teacherProfiles.userId))
      .where(
        and(
          eq(teacherProfiles.verificationStatus, "approved"),
          isNull(users.deletedAt),
        ),
      ),
    db
      .select()
      .from(mobileDevices)
      .where(eq(mobileDevices.userId, actor.userId)),
    flags.staff
      ? db.select({ n: count() }).from(mobileDevices)
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(bookings)
      .where(bookingWhere ?? sql`true`),
    db.select({ n: count() }).from(bookings).where(chargeWhere),
    flags.staff || flags.teacher
      ? db
          .select({ n: count() })
          .from(financeOperations)
          .where(
            flags.staff
              ? eq(financeOperations.kind, "payout")
              : and(
                  eq(financeOperations.kind, "payout"),
                  eq(financeOperations.counterpartyUserId, actor.userId),
                ),
          )
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: count() })
      .from(classrooms)
      .where(
        flags.staff
          ? sql`true`
          : flags.teacher
            ? eq(classrooms.teacherUserId, actor.userId)
            : or(
                bookingWhere
                  ? inArray(
                      classrooms.bookingId,
                      db
                        .select({ id: bookings.id })
                        .from(bookings)
                        .where(bookingWhere),
                    )
                  : sql`false`,
                inArray(
                  classrooms.id,
                  db
                    .select({ id: classroomParticipants.classroomId })
                    .from(classroomParticipants)
                    .where(eq(classroomParticipants.userId, actor.userId)),
                ),
              ),
      ),
    db
      .select({ n: count() })
      .from(secureThreads)
      .where(
        or(
          eq(secureThreads.participantLow, actor.userId),
          eq(secureThreads.participantHigh, actor.userId),
        ),
      ),
    flags.staff
      ? db.select({ n: count() }).from(homeworks)
      : flags.teacher
        ? db
            .select({ n: count() })
            .from(homeworks)
            .where(eq(homeworks.createdByUserId, actor.userId))
        : db
            .select({ n: count() })
            .from(homeworkWork)
            .where(people(homeworkWork.studentUserId)),
    db
      .select({ n: count() })
      .from(lessonHistory)
      .where(people(lessonHistory.studentUserId)),
    db
      .select({ n: count() })
      .from(islamicProgress)
      .where(people(islamicProgress.studentUserId)),
    db
      .select({ n: count() })
      .from(userNotifications)
      .where(eq(userNotifications.userId, actor.userId)),
    db
      .select({ n: count() })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, actor.userId),
          isNull(userNotifications.readAt),
        ),
      ),
    db
      .select({ n: count() })
      .from(recordings)
      .where(
        flags.staff
          ? sql`true`
          : inArray(
              recordings.classroomId,
              db
                .select({ id: classrooms.id })
                .from(classrooms)
                .where(
                  flags.teacher
                    ? eq(classrooms.teacherUserId, actor.userId)
                    : or(
                        bookingWhere
                          ? inArray(
                              classrooms.bookingId,
                              db
                                .select({ id: bookings.id })
                                .from(bookings)
                                .where(bookingWhere),
                            )
                          : sql`false`,
                        inArray(
                          classrooms.id,
                          db
                            .select({ id: classroomParticipants.classroomId })
                            .from(classroomParticipants)
                            .where(eq(classroomParticipants.userId, actor.userId)),
                        ),
                      ),
                ),
            ),
      ),
    db
      .select({ n: count() })
      .from(teachingMaterials)
      .where(eq(teachingMaterials.status, "published")),
    flags.teacher
      ? db
          .select({ n: count() })
          .from(teachingMaterials)
          .where(
            and(
              eq(teachingMaterials.status, "published"),
              eq(teachingMaterials.createdByUserId, actor.userId),
            ),
          )
      : Promise.resolve([{ n: 0 }]),
    db
      .select({
        id: bookings.id,
        title: bookings.subjectSlug,
        status: bookings.status,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .where(bookingWhere ?? sql`true`)
      .orderBy(desc(bookings.startsAt))
      .limit(5),
    db
      .select({
        id: classrooms.id,
        title: classrooms.title,
        status: classrooms.status,
        bookingId: classrooms.bookingId,
      })
      .from(classrooms)
      .where(
        flags.staff
          ? sql`true`
          : flags.teacher
            ? eq(classrooms.teacherUserId, actor.userId)
            : or(
                bookingWhere
                  ? inArray(
                      classrooms.bookingId,
                      db
                        .select({ id: bookings.id })
                        .from(bookings)
                        .where(bookingWhere),
                    )
                  : sql`false`,
                inArray(
                  classrooms.id,
                  db
                    .select({ id: classroomParticipants.classroomId })
                    .from(classroomParticipants)
                    .where(eq(classroomParticipants.userId, actor.userId)),
                ),
              ),
      )
      .orderBy(desc(classrooms.joinOpensAt))
      .limit(5),
    db
      .select({
        id: secureThreads.id,
        channel: secureThreads.channel,
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
      .limit(5),
    flags.staff || flags.teacher
      ? db
          .select({
            id: homeworks.id,
            title: homeworks.title,
            status: homeworks.status,
          })
          .from(homeworks)
          .where(
            flags.teacher
              ? eq(homeworks.createdByUserId, actor.userId)
              : sql`true`,
          )
          .orderBy(desc(homeworks.createdAt))
          .limit(5)
      : db
          .select({
            id: homeworks.id,
            title: homeworks.title,
            status: homeworkWork.status,
          })
          .from(homeworkWork)
          .innerJoin(homeworks, eq(homeworks.id, homeworkWork.homeworkId))
          .where(people(homeworkWork.studentUserId))
          .orderBy(desc(homeworkWork.createdAt))
          .limit(5),
    db
      .select({
        id: lessonHistory.id,
        title: lessonHistory.title,
        status: lessonHistory.status,
        startedAt: lessonHistory.startedAt,
      })
      .from(lessonHistory)
      .where(people(lessonHistory.studentUserId))
      .orderBy(desc(lessonHistory.startedAt))
      .limit(5),
    db
      .select({
        id: islamicProgress.id,
        track: islamicProgress.track,
        updatedAt: islamicProgress.updatedAt,
      })
      .from(islamicProgress)
      .where(people(islamicProgress.studentUserId))
      .orderBy(desc(islamicProgress.updatedAt))
      .limit(5),
    db
      .select({
        id: userNotifications.id,
        title: userNotifications.title,
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .where(eq(userNotifications.userId, actor.userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(5),
    db
      .select({
        id: recordings.id,
        status: recordings.status,
        startedAt: recordings.startedAt,
      })
      .from(recordings)
      .where(
        flags.staff
          ? sql`true`
          : inArray(
              recordings.classroomId,
              db
                .select({ id: classrooms.id })
                .from(classrooms)
                .where(
                  flags.teacher
                    ? eq(classrooms.teacherUserId, actor.userId)
                    : or(
                        bookingWhere
                          ? inArray(
                              classrooms.bookingId,
                              db
                                .select({ id: bookings.id })
                                .from(bookings)
                                .where(bookingWhere),
                            )
                          : sql`false`,
                        inArray(
                          classrooms.id,
                          db
                            .select({ id: classroomParticipants.classroomId })
                            .from(classroomParticipants)
                            .where(
                              eq(classroomParticipants.userId, actor.userId),
                            ),
                        ),
                      ),
                ),
            ),
      )
      .orderBy(desc(recordings.startedAt))
      .limit(5),
    db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
        category: teachingMaterials.category,
      })
      .from(teachingMaterials)
      .where(eq(teachingMaterials.status, "published"))
      .orderBy(desc(teachingMaterials.updatedAt))
      .limit(5),
  ]);

  const num = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
  const platforms = { ios: 0, android: 0, web: 0 };
  for (const device of deviceRows) {
    platforms[device.platform] += 1;
  }

  return {
    account: {
      userId: actor.userId,
      roleKey: actor.roleKey,
      learnerIds: learnerIds ?? [],
    },
    links: hrefs(flags),
    ios: {
      bundleId: IOS_BUNDLE_ID,
      project: "mobile",
      storeSubmitted: false,
      registered: platforms.ios > 0,
      rows: deviceRows
        .filter((row) => row.platform === "ios")
        .map((row) => ({
          id: row.id,
          title: "iOS",
          meta: when(row.lastSeenAt),
        })),
    },
    android: {
      packageName: ANDROID_PACKAGE,
      project: "mobile",
      storeSubmitted: false,
      registered: platforms.android > 0,
      rows: deviceRows
        .filter((row) => row.platform === "android")
        .map((row) => ({
          id: row.id,
          title: "Android",
          meta: when(row.lastSeenAt),
        })),
    },
    login: {
      method: "bearer" as const,
      website: "cookie" as const,
    },
    search: {
      approved: num(teacherRows),
    },
    booking: {
      lessons: num(bookingRows),
      rows: bookingList.map((row) => ({
        id: row.id,
        title: row.title,
        meta: `${row.status} · ${when(row.startsAt)}`,
      })),
    },
    payments: {
      lessons: num(chargeRows),
      payouts: flags.staff || flags.teacher ? num(payoutRows) : null,
      rows: bookingList
        .filter((row) => row.status !== "cancelled")
        .map((row) => ({
          id: row.id,
          title: row.title,
          meta: row.status,
        })),
    },
    classroom: {
      rooms: num(classroomRows),
      rows: classroomList.map((row) => ({
        id: row.id,
        title: row.title,
        meta: row.status,
        bookingId: row.bookingId,
      })),
    },
    messaging: {
      conversations: num(messageRows),
      rows: messageList.map((row) => ({
        id: row.id,
        title: row.channel,
        meta: when(row.updatedAt),
      })),
    },
    homework: {
      pieces: num(homeworkRows),
      rows: homeworkList.map((row) => ({
        id: row.id,
        title: row.title,
        meta: row.status,
      })),
    },
    reports: {
      records: num(reportRows),
      rows: reportList.map((row) => ({
        id: row.id,
        title: row.title,
        meta: `${row.status} · ${when(row.startedAt)}`,
      })),
    },
    progress: {
      rowsCount: num(progressRows),
      rows: progressList.map((row) => ({
        id: row.id,
        title: row.track,
        meta: when(row.updatedAt),
      })),
    },
    notifications: {
      total: num(notificationRows),
      unread: num(unreadRows),
      rows: notificationList.map((row) => ({
        id: row.id,
        title: row.title,
        meta: when(row.createdAt),
      })),
    },
    recordings: {
      total: num(recordingRows),
      rows: recordingList.map((row) => ({
        id: row.id,
        title: row.status,
        meta: when(row.startedAt),
      })),
    },
    materials: {
      published: num(materialRows),
      yours: flags.teacher ? num(ownMaterialRows) : null,
      rows: materialList.map((row) => ({
        id: row.id,
        title: row.title,
        meta: row.category,
      })),
    },
    push: {
      connected: false,
      sent: 0,
      devices: deviceRows.length,
      allDevices: flags.staff ? num(allDeviceRows) : null,
      ...platforms,
      rows: deviceRows.map((row) => ({
        id: row.id,
        title: row.platform,
        meta: when(row.lastSeenAt),
      })),
    },
  };
}
