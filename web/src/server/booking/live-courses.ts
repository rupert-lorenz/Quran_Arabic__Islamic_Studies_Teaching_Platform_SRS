import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  currencies,
  groupLessonEnrollments,
  groupLessons,
  liveCourseEnrollments,
  liveCourses,
  parentChildren,
  studentProfiles,
  subjects,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import { rangesOverlap } from "@/lib/booking";
import { formatMoneyMinor } from "@/lib/teacher-rate-display";
import {
  addCalendarDays,
  convertedTimeLabels,
  zonedHms,
  zonedLocalToUtc,
  zonedYmd,
} from "@/lib/timezone";
import { withLock } from "@/redis/locks";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import {
  assertBookingMinNotice,
  resolveDisplayTimeZone,
  resolveScheduleTimeZone,
  resolveTeacherMinNotice,
} from "./policy";
import type {
  CreateLiveCourseInput,
  EnrollLiveCourseInput,
} from "./schemas";
import { listTeacherSlots } from "./slots";

export type LiveCourseView = {
  id: string;
  teacherUserId: string;
  teacherName: string;
  subjectSlug: string;
  subjectName: string;
  title: string;
  description: string | null;
  status: string;
  firstStartsAt: string;
  lastEndsAt: string;
  firstWhenLabel: string;
  durationMinutes: number;
  sessionCount: number;
  timezone: string;
  teacherTimezone: string;
  capacity: number;
  enrolledCount: number;
  placesLeft: number;
  isFull: boolean;
  amountFormatted: string;
  sessions: {
    id: string;
    index: number;
    startsAt: string;
    whenLabel: string;
  }[];
};

function addWeeksInZone(start: Date, timeZone: string, weeks: number) {
  const date = zonedYmd(start, timeZone);
  const clock = zonedHms(start, timeZone);
  const next = addCalendarDays(date.iso, weeks * 7).split("-").map(Number);
  return zonedLocalToUtc(timeZone, next[0], next[1], next[2], clock.hour, clock.minute);
}

async function requireCourseStudent(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student") {
    if (actor.userId !== studentUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only enrol yourself");
    }
    const [profile] = await db
      .select({ parentManaged: studentProfiles.parentManaged })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, studentUserId))
      .limit(1);
    if (profile && !profile.parentManaged) return;
  }
  if (actor.roleKey === "parent") {
    const [child] = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(
        and(
          eq(parentChildren.parentUserId, actor.userId),
          eq(parentChildren.childUserId, studentUserId),
        ),
      )
      .limit(1);
    if (child) return;
  }
  throw new ApiError(403, "FORBIDDEN", "Only a parent or independent student can enrol");
}

async function hydrateCourses(
  rows: (typeof liveCourses.$inferSelect)[],
  timeZone: string,
): Promise<LiveCourseView[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [teachers, subjectRows, currencyRows, enrollmentRows, sessionRows] =
    await Promise.all([
      db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .where(inArray(users.id, [...new Set(rows.map((row) => row.teacherUserId))])),
      db
        .select({ slug: subjects.slug, name: subjects.name })
        .from(subjects)
        .where(inArray(subjects.slug, [...new Set(rows.map((row) => row.subjectSlug))])),
      db
        .select({
          code: currencies.code,
          symbol: currencies.symbol,
          decimalPlaces: currencies.decimalPlaces,
        })
        .from(currencies)
        .where(inArray(currencies.code, [...new Set(rows.map((row) => row.currencyCode))])),
      db
        .select({
          courseId: liveCourseEnrollments.liveCourseId,
          status: liveCourseEnrollments.status,
        })
        .from(liveCourseEnrollments)
        .where(inArray(liveCourseEnrollments.liveCourseId, ids)),
      db
        .select({
          id: groupLessons.id,
          courseId: groupLessons.liveCourseId,
          index: groupLessons.courseSessionIndex,
          startsAt: groupLessons.startsAt,
        })
        .from(groupLessons)
        .where(inArray(groupLessons.liveCourseId, ids))
        .orderBy(asc(groupLessons.startsAt)),
    ]);
  const names = new Map(teachers.map((row) => [row.id, row.name]));
  const subjectNames = new Map(subjectRows.map((row) => [row.slug, row.name]));
  const money = new Map(currencyRows.map((row) => [row.code, row]));
  return rows.map((row) => {
    const enrolledCount = enrollmentRows.filter(
      (item) => item.courseId === row.id && item.status === "confirmed",
    ).length;
    const currency = money.get(row.currencyCode);
    return {
      id: row.id,
      teacherUserId: row.teacherUserId,
      teacherName: names.get(row.teacherUserId) ?? "Teacher",
      subjectSlug: row.subjectSlug,
      subjectName: subjectNames.get(row.subjectSlug) ?? row.subjectSlug,
      title: row.title,
      description: row.description,
      status: row.status,
      firstStartsAt: row.firstStartsAt.toISOString(),
      lastEndsAt: row.lastEndsAt.toISOString(),
      firstWhenLabel: convertedTimeLabels(row.firstStartsAt, timeZone, row.timezone).viewer,
      durationMinutes: row.durationMinutes,
      sessionCount: row.sessionCount,
      timezone: timeZone,
      teacherTimezone: row.timezone,
      capacity: row.capacity,
      enrolledCount,
      placesLeft: Math.max(0, row.capacity - enrolledCount),
      isFull: enrolledCount >= row.capacity,
      amountFormatted: currency
        ? formatMoneyMinor(row.amountMinor, currency.decimalPlaces, currency.symbol)
        : `${row.amountMinor} ${row.currencyCode}`,
      sessions: sessionRows
        .filter((session) => session.courseId === row.id)
        .map((session, index) => ({
          id: session.id,
          index: session.index ?? index + 1,
          startsAt: session.startsAt.toISOString(),
          whenLabel: convertedTimeLabels(session.startsAt, timeZone, row.timezone).viewer,
        })),
    };
  });
}

export async function listPublicLiveCourses(
  viewerUserId?: string | null,
  requestedTimeZone?: string,
) {
  const timeZone = await resolveDisplayTimeZone(viewerUserId, requestedTimeZone);
  const rows = await db
    .select()
    .from(liveCourses)
    .where(
      and(
        eq(liveCourses.status, "published"),
        gte(liveCourses.lastEndsAt, new Date()),
      ),
    )
    .orderBy(asc(liveCourses.firstStartsAt));
  return { timeZone, courses: await hydrateCourses(rows, timeZone) };
}

export async function listTeacherLiveCourses(teacherUserId: string) {
  const timeZone = await resolveScheduleTimeZone(teacherUserId);
  const rows = await db
    .select()
    .from(liveCourses)
    .where(eq(liveCourses.teacherUserId, teacherUserId))
    .orderBy(asc(liveCourses.firstStartsAt));
  return hydrateCourses(rows, timeZone);
}

export async function createLiveCourse(
  actor: ApiActor,
  input: CreateLiveCourseInput,
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can publish live courses");
  }
  const [teacher] = await db
    .select({
      status: users.status,
      verification: teacherProfiles.verificationStatus,
      currencyCode: teacherProfiles.currencyCode,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(users.id, teacherProfiles.userId))
    .where(eq(teacherProfiles.userId, actor.userId))
    .limit(1);
  if (
    !teacher ||
    teacher.status !== "active" ||
    teacher.verification !== "approved" ||
    !teacher.currencyCode
  ) {
    throw new ApiError(403, "LOCKED", "Complete teacher approval and pricing first");
  }
  const currencyCode = teacher.currencyCode;
  const [[offered], [currency]] = await Promise.all([
    db
      .select({ slug: teacherSubjects.subjectSlug })
      .from(teacherSubjects)
      .where(
        and(
          eq(teacherSubjects.teacherUserId, actor.userId),
          eq(teacherSubjects.subjectSlug, input.subjectSlug),
        ),
      )
      .limit(1),
    db
      .select({ decimalPlaces: currencies.decimalPlaces })
      .from(currencies)
      .where(eq(currencies.code, currencyCode))
      .limit(1),
  ]);
  if (!offered) throw new ApiError(422, "VALIDATION", "Choose a subject you teach");
  const firstStart = new Date(input.firstStartsAt);
  if (Number.isNaN(firstStart.getTime())) {
    throw new ApiError(422, "VALIDATION", "Choose a valid first session");
  }
  const notice = await resolveTeacherMinNotice(actor.userId);
  assertBookingMinNotice(firstStart, notice.effectiveMinutes);
  const teacherZone = await resolveScheduleTimeZone(actor.userId);
  const starts = Array.from({ length: input.sessionCount }, (_, index) =>
    addWeeksInZone(firstStart, teacherZone, index),
  );
  const lastStart = starts[starts.length - 1];
  const slots = await listTeacherSlots(actor.userId, {
    durationMinutes: input.durationMinutes,
    timeZone: teacherZone,
    viewerUserId: actor.userId,
    from: zonedYmd(firstStart, teacherZone).iso,
    to: zonedYmd(lastStart, teacherZone).iso,
  });
  for (const [index, start] of starts.entries()) {
    if (!slots.slots.some((slot) => new Date(slot.startsAt).getTime() === start.getTime())) {
      throw new ApiError(
        409,
        "SLOT_TAKEN",
        `Session ${index + 1} is not available at that weekly time`,
      );
    }
  }
  const amountMinor = Math.round(input.priceMajor * 10 ** (currency?.decimalPlaces ?? 2));
  const lastEnd = new Date(lastStart.getTime() + input.durationMinutes * 60_000);
  const saved = await withLock(`booking:${actor.userId}`, 8_000, async () => {
    const [privateRows, groupRows] = await Promise.all([
      db
        .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
        .from(bookings)
        .where(
          and(
            eq(bookings.teacherUserId, actor.userId),
            inArray(bookings.status, ["confirmed", "completed"]),
          ),
        ),
      db
        .select({ startsAt: groupLessons.startsAt, endsAt: groupLessons.endsAt })
        .from(groupLessons)
        .where(
          and(
            eq(groupLessons.teacherUserId, actor.userId),
            eq(groupLessons.status, "published"),
          ),
        ),
    ]);
    if (
      starts.some((start) => {
        const end = new Date(start.getTime() + input.durationMinutes * 60_000);
        return [...privateRows, ...groupRows].some((row) =>
          rangesOverlap(start, end, row.startsAt, row.endsAt),
        );
      })
    ) {
      throw new ApiError(409, "SLOT_TAKEN", "One of the weekly sessions is no longer available");
    }
    return db.transaction(async (tx) => {
      const [course] = await tx
        .insert(liveCourses)
        .values({
          teacherUserId: actor.userId,
          subjectSlug: input.subjectSlug,
          title: input.title,
          description: input.description || null,
          firstStartsAt: firstStart,
          lastEndsAt: lastEnd,
          durationMinutes: input.durationMinutes,
          sessionCount: input.sessionCount,
          timezone: teacherZone,
          capacity: input.capacity,
          amountMinor,
          currencyCode,
          createdByUserId: actor.userId,
        })
        .returning();
      if (!course) throw new ApiError(500, "INTERNAL", "Could not save live course");
      await tx.insert(groupLessons).values(
        starts.map((start, index) => ({
          teacherUserId: actor.userId,
          liveCourseId: course.id,
          courseSessionIndex: index + 1,
          courseSessionTotal: input.sessionCount,
          subjectSlug: input.subjectSlug,
          title: `${input.title} · ${index + 1}/${input.sessionCount}`,
          description: input.description || null,
          startsAt: start,
          endsAt: new Date(start.getTime() + input.durationMinutes * 60_000),
          durationMinutes: input.durationMinutes,
          timezone: teacherZone,
          capacity: input.capacity,
          amountMinor: 0,
          currencyCode,
          createdByUserId: actor.userId,
        })),
      );
      return course;
    });
  });
  await writeAuditLog({
    actor,
    action: "live_courses.created",
    entityType: "live_course",
    entityId: saved.id,
    ipAddress: ip,
    metadata: { sessionCount: input.sessionCount, capacity: input.capacity },
  });
  return (await hydrateCourses([saved], teacherZone))[0];
}

export async function enrollLiveCourse(
  actor: ApiActor,
  courseId: string,
  input: EnrollLiveCourseInput,
  ip: string,
) {
  await requireCourseStudent(actor, input.studentUserId);
  return withLock(`live-course:${courseId}`, 8_000, () =>
    withLock(`booking:student:${input.studentUserId}`, 8_000, async () => {
      const [course] = await db
        .select()
        .from(liveCourses)
        .where(eq(liveCourses.id, courseId))
        .limit(1);
      if (!course || course.status !== "published" || course.firstStartsAt <= new Date()) {
        throw new ApiError(400, "LOCKED", "This live course is not open");
      }
      const existing = await db
        .select({ id: liveCourseEnrollments.id })
        .from(liveCourseEnrollments)
        .where(
          and(
            eq(liveCourseEnrollments.liveCourseId, courseId),
            eq(liveCourseEnrollments.studentUserId, input.studentUserId),
          ),
        )
        .limit(1);
      if (existing.length) {
        throw new ApiError(409, "CONFLICT", "This student is already enrolled");
      }
      const enrolled = await db
        .select({ id: liveCourseEnrollments.id })
        .from(liveCourseEnrollments)
        .where(
          and(
            eq(liveCourseEnrollments.liveCourseId, courseId),
            eq(liveCourseEnrollments.status, "confirmed"),
          ),
        );
      if (enrolled.length >= course.capacity) {
        throw new ApiError(409, "SLOT_TAKEN", "This live course is full");
      }
      const sessions = await db
        .select()
        .from(groupLessons)
        .where(eq(groupLessons.liveCourseId, courseId))
        .orderBy(asc(groupLessons.startsAt));
      const [privateRows, groupRows] = await Promise.all([
        db
          .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
          .from(bookings)
          .where(
            and(
              eq(bookings.studentUserId, input.studentUserId),
              inArray(bookings.status, ["confirmed", "completed"]),
            ),
          ),
        db
          .select({ startsAt: groupLessons.startsAt, endsAt: groupLessons.endsAt })
          .from(groupLessonEnrollments)
          .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
          .where(
            and(
              eq(groupLessonEnrollments.studentUserId, input.studentUserId),
              eq(groupLessonEnrollments.status, "confirmed"),
            ),
          ),
      ]);
      if (
        sessions.some((session) =>
          [...privateRows, ...groupRows].some((row) =>
            rangesOverlap(session.startsAt, session.endsAt, row.startsAt, row.endsAt),
          ),
        )
      ) {
        throw new ApiError(409, "SLOT_TAKEN", "A course session conflicts with another lesson");
      }
      const enrollment = await db.transaction(async (tx) => {
        const [saved] = await tx
          .insert(liveCourseEnrollments)
          .values({
            liveCourseId: courseId,
            studentUserId: input.studentUserId,
            bookedByUserId: actor.userId,
            amountMinor: course.amountMinor,
            currencyCode: course.currencyCode,
          })
          .returning();
        await tx.insert(groupLessonEnrollments).values(
          sessions.map((session) => ({
            groupLessonId: session.id,
            studentUserId: input.studentUserId,
            bookedByUserId: actor.userId,
            amountMinor: 0,
            currencyCode: course.currencyCode,
          })),
        );
        return saved;
      });
      await writeAuditLog({
        actor,
        action: "live_courses.enrolled",
        entityType: "live_course_enrollment",
        entityId: enrollment.id,
        ipAddress: ip,
        metadata: { courseId, studentUserId: input.studentUserId },
      });
      return { courseId, enrollmentId: enrollment.id };
    }),
  );
}
