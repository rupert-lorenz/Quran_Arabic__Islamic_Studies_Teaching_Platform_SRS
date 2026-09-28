import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  currencies,
  groupLessonEnrollments,
  groupLessons,
  lessonHistory,
  parentChildren,
  studentProfiles,
  subjects,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import {
  DEFAULT_GROUP_MIN_STUDENTS,
  formatWeekdayList,
  groupClassEnrollmentStats,
  publicGroupClassHref,
  MAX_GROUP_CLASS_DAYS,
  MAX_GROUP_CLASS_SESSIONS,
  rangesOverlap,
  resolveGroupMinStudents,
  sortedWeekdays,
} from "@/lib/booking";
import { classroomJoinFields } from "@/lib/classroom";
import { timezoneOptions } from "@/lib/geo";
import { presentStudentAmount } from "@/lib/currency";
import {
  formatMoneyMinor,
  omitInternalTeacherPayment,
  splitLessonRate,
} from "@/lib/teacher-rate-display";
import { getRequestMoney } from "@/server/money/currency";
import { getTeacherRateLimits } from "@/server/teacher/profile";
import { defaultLessonTitle } from "@/lib/lesson-history";
import { attendedMinutesForRecord } from "@/server/classroom/attendance";
import {
  addCalendarDays,
  availabilityDate,
  convertedTimeLabels,
  eachIsoDate,
  formatInTimeZone,
  formatIsoDateLabel,
  isoDateDiffDays,
  parseIsoDate,
  zonedHms,
  zonedLocalToUtc,
  zonedWeekday,
  zonedYmd,
} from "@/lib/timezone";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { withLock } from "@/redis/locks";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type {
  CreateGroupLessonInput,
  AdminCreateGroupLessonInput,
  EnrollGroupLessonInput,
  GroupTeachingSettingsInput,
} from "./schemas";
import {
  resolveDisplayTimeZone,
  resolveScheduleTimeZone,
} from "./policy";
import { listTeacherSlots } from "./slots";
import {
  notifyGroupPlaceAvailable,
  notifyGroupPlaceReserved,
} from "@/server/notifications/service";

export type GroupLessonView = {
  id: string;
  teacherUserId: string;
  teacherName: string;
  subjectSlug: string;
  subjectName: string;
  title: string;
  description: string | null;
  level: string;
  minAge: number | null;
  maxAge: number | null;
  status: string;
  startsAt: string;
  endsAt: string;
  whenLabel: string;
  teacherWhenLabel: string | null;
  durationMinutes: number;
  timezone: string;
  teacherTimezone: string;
  capacity: number;
  minStudents: number;
  enrolledCount: number;
  placesLeft: number;
  isFull: boolean;
  waitlistCount: number;
  meetsMinimum: boolean;
  studentsNeeded: number;
  isUnderEnrolled: boolean;
  amountMinor: number;
  currencyCode: string;
  amountFormatted: string;
  studentPriceMinor: number;
  studentPriceFormatted: string;
  seriesSessionCount: number;
  seriesTotalMinor: number;
  seriesTotalFormatted: string;
  listedPriceFormatted: string | null;
  priceConverted: boolean;
  teacherPaymentMinor?: number | null;
  teacherPaymentFormatted?: string | null;
  teacherPaymentSeriesFormatted?: string | null;
  seriesId: string | null;
  seriesIndex: number | null;
  seriesTotal: number | null;
  startsOn: string | null;
  endsOn: string | null;
  weekdays: number[];
  weekInterval: number;
  scheduleLabel: string | null;
  visibleFrom: string | null;
  visibleFromLabel: string | null;
  applicationDeadline: string | null;
  applicationDeadlineLabel: string | null;
  isVisible: boolean;
  isOpenForEnrolment: boolean;
  classroomJoinable: boolean;
  classroomHref: string;
  classroomOpensAt: string;
};

export async function getGroupTeachingSettings(teacherUserId: string) {
  const [profile] = await db
    .select({
      offersGroupTeaching: teacherProfiles.offersGroupTeaching,
      defaultGroupCapacity: teacherProfiles.defaultGroupCapacity,
      defaultGroupMinStudents: teacherProfiles.defaultGroupMinStudents,
    })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (!profile) {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found");
  }
  return profile;
}

export async function setGroupTeachingSettings(
  actor: ApiActor,
  input: GroupTeachingSettingsInput,
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can change this setting");
  }
  const [updated] = await db
    .update(teacherProfiles)
    .set({
      offersGroupTeaching: input.offersGroupTeaching,
      defaultGroupCapacity: input.defaultGroupCapacity,
      defaultGroupMinStudents: resolveGroupMinStudents(
        input.defaultGroupMinStudents,
        input.defaultGroupCapacity,
      ),
    })
    .where(eq(teacherProfiles.userId, actor.userId))
    .returning({
      offersGroupTeaching: teacherProfiles.offersGroupTeaching,
      defaultGroupCapacity: teacherProfiles.defaultGroupCapacity,
      defaultGroupMinStudents: teacherProfiles.defaultGroupMinStudents,
    });
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found");
  }
  await writeAuditLog({
    actor,
    action: "group_teaching.settings_updated",
    entityType: "teacher_profile",
    entityId: actor.userId,
    ipAddress: ip,
    metadata: updated,
  });
  return updated;
}

export async function listAdminGroupTeachingTeachers(actor: ApiActor) {
  if (
    !isStaffRole(actor.roleKey) ||
    !hasAnyPermission(actor, "classes.manage")
  ) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage group classes");
  }
  const teacherRows = await db
    .select({
      userId: teacherProfiles.userId,
      displayName: users.displayName,
      currencyCode: teacherProfiles.currencyCode,
      defaultGroupCapacity: teacherProfiles.defaultGroupCapacity,
      defaultGroupMinStudents: teacherProfiles.defaultGroupMinStudents,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(users.id, teacherProfiles.userId))
    .where(
      and(
        eq(users.status, "active"),
        eq(teacherProfiles.verificationStatus, "approved"),
        eq(teacherProfiles.offersGroupTeaching, true),
      ),
    )
    .orderBy(asc(users.displayName));
  if (!teacherRows.length) return [];
  const subjectRows = await db
    .select({
      teacherUserId: teacherSubjects.teacherUserId,
      slug: subjects.slug,
      name: subjects.name,
    })
    .from(teacherSubjects)
    .innerJoin(subjects, eq(subjects.slug, teacherSubjects.subjectSlug))
    .where(
      inArray(
        teacherSubjects.teacherUserId,
        teacherRows.map((teacher) => teacher.userId),
      ),
    )
    .orderBy(asc(subjects.sortOrder));
  return teacherRows.map((teacher) => ({
    ...teacher,
    currencyCode: teacher.currencyCode ?? "USD",
    subjects: subjectRows
      .filter((subject) => subject.teacherUserId === teacher.userId)
      .map(({ slug, name }) => ({ slug, name })),
  }));
}

function addWeeksInZone(start: Date, timeZone: string, weeks: number) {
  const ymd = zonedYmd(start, timeZone);
  const clock = zonedHms(start, timeZone);
  const nextIso = addCalendarDays(ymd.iso, weeks * 7);
  const [year, month, day] = nextIso.split("-").map(Number);
  return zonedLocalToUtc(
    timeZone,
    year,
    month,
    day,
    clock.hour,
    clock.minute,
  );
}

function serializeWeekdays(values: number[]) {
  return sortedWeekdays(values).join(",");
}

function parseWeekdays(value?: string | null) {
  if (!value) return [];
  return sortedWeekdays(
    value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6),
  );
}

function scheduleLabelFor(
  startsOn: string | null,
  endsOn: string | null,
  weekdays: number[],
  weekInterval: number,
) {
  if (!startsOn || !endsOn || !weekdays.length) return null;
  const days = formatWeekdayList(weekdays);
  const range =
    startsOn === endsOn
      ? formatIsoDateLabel(startsOn)
      : `${formatIsoDateLabel(startsOn)} – ${formatIsoDateLabel(endsOn)}`;
  const interval =
    weekInterval > 1 ? `every ${weekInterval} weeks` : "weekly";
  return startsOn === endsOn && weekdays.length === 1
    ? `${days} · ${range}`
    : `${days} · ${range} · ${interval}`;
}

function parseScheduleInstant(
  value: string | undefined,
  timeZone: string,
  clock: { hour: number; minute: number },
  invalidMessage: string,
) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const { year, month, day } = parseIsoDate(trimmed);
    return zonedLocalToUtc(
      timeZone,
      year,
      month,
      day,
      clock.hour,
      clock.minute,
    );
  }
  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) {
    throw new ApiError(422, "VALIDATION", invalidMessage);
  }
  return instant;
}

function generateGroupClassStarts(input: {
  templateStart: Date;
  timeZone: string;
  startsOn: string;
  endsOn: string;
  weekdays: number[];
  weekInterval: number;
}) {
  const clock = zonedHms(input.templateStart, input.timeZone);
  const days = sortedWeekdays(input.weekdays);
  const starts: Date[] = [];
  for (const isoDate of eachIsoDate(input.startsOn, input.endsOn)) {
    const { year, month, day } = parseIsoDate(isoDate);
    const noon = zonedLocalToUtc(input.timeZone, year, month, day, 12, 0);
    const weekday = zonedWeekday(noon, input.timeZone);
    if (!days.some((day) => day === weekday)) continue;
    if (Math.floor(isoDateDiffDays(input.startsOn, isoDate) / 7) % input.weekInterval !== 0) {
      continue;
    }
    starts.push(
      zonedLocalToUtc(input.timeZone, year, month, day, clock.hour, clock.minute),
    );
  }
  return starts;
}

function ageOnDate(dateOfBirth: Date, date: Date) {
  let age = date.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    date.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (date.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      date.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

async function requireStudentForEnrollment(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student") {
    if (actor.userId !== studentUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only enrol yourself");
    }
    const [student] = await db
      .select({ parentManaged: studentProfiles.parentManaged })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, studentUserId))
      .limit(1);
    if (!student || student.parentManaged) {
      throw new ApiError(403, "FORBIDDEN", "Your parent manages lesson enrolments");
    }
    return;
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

function waitlistPositionMap(
  rows: { id: string; lessonId: string; status: string; createdAt: Date }[],
) {
  const waiting = rows
    .filter((row) => row.status === "waitlisted")
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    );
  const positions = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const row of waiting) {
    const next = (counts.get(row.lessonId) ?? 0) + 1;
    counts.set(row.lessonId, next);
    positions.set(row.id, next);
  }
  return positions;
}

async function studentHasGroupScheduleConflict(
  studentUserId: string,
  lesson: { id: string; startsAt: Date; endsAt: Date },
) {
  const [privateBookings, otherGroupEnrollments] = await Promise.all([
    db
      .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.studentUserId, studentUserId),
          inArray(bookings.status, ["confirmed", "completed"]),
        ),
      ),
    db
      .select({ startsAt: groupLessons.startsAt, endsAt: groupLessons.endsAt })
      .from(groupLessonEnrollments)
      .innerJoin(
        groupLessons,
        eq(groupLessons.id, groupLessonEnrollments.groupLessonId),
      )
      .where(
        and(
          eq(groupLessonEnrollments.studentUserId, studentUserId),
          eq(groupLessonEnrollments.status, "confirmed"),
          ne(groupLessons.id, lesson.id),
        ),
      ),
  ]);
  return [...privateBookings, ...otherGroupEnrollments].some((row) =>
    rangesOverlap(lesson.startsAt, lesson.endsAt, row.startsAt, row.endsAt),
  );
}

async function studentOutsideClassAge(
  studentUserId: string,
  lesson: { startsAt: Date; minAge: number | null; maxAge: number | null },
) {
  if (lesson.minAge == null && lesson.maxAge == null) return false;
  const [student] = await db
    .select({ dateOfBirth: studentProfiles.dateOfBirth })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
    .limit(1);
  if (!student?.dateOfBirth) return true;
  const age = ageOnDate(student.dateOfBirth, lesson.startsAt);
  return (
    (lesson.minAge != null && age < lesson.minAge) ||
    (lesson.maxAge != null && age > lesson.maxAge)
  );
}

async function saveGroupEnrollment(input: {
  existingId?: string;
  groupLessonId: string;
  studentUserId: string;
  bookedByUserId: string;
  amountMinor: number;
  currencyCode: string;
  status: "confirmed" | "waitlisted";
}) {
  const values = {
    status: input.status,
    bookedByUserId: input.bookedByUserId,
    amountMinor: input.amountMinor,
    currencyCode: input.currencyCode,
    cancelledAt: null,
    cancelledByUserId: null,
    cancelReason: null,
    lessonHistoryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const [saved] = input.existingId
    ? await db
        .update(groupLessonEnrollments)
        .set(values)
        .where(eq(groupLessonEnrollments.id, input.existingId))
        .returning()
    : await db
        .insert(groupLessonEnrollments)
        .values({
          groupLessonId: input.groupLessonId,
          studentUserId: input.studentUserId,
          ...values,
        })
        .returning();
  return saved;
}

async function promoteNextWaitlisted(
  lesson: typeof groupLessons.$inferSelect,
  actor: ApiActor,
  ip: string,
) {
  const confirmed = await db
    .select({ id: groupLessonEnrollments.id })
    .from(groupLessonEnrollments)
    .where(
      and(
        eq(groupLessonEnrollments.groupLessonId, lesson.id),
        eq(groupLessonEnrollments.status, "confirmed"),
      ),
    );
  if (confirmed.length >= lesson.capacity) return null;
  const waiting = await db
    .select()
    .from(groupLessonEnrollments)
    .where(
      and(
        eq(groupLessonEnrollments.groupLessonId, lesson.id),
        eq(groupLessonEnrollments.status, "waitlisted"),
      ),
    )
    .orderBy(asc(groupLessonEnrollments.createdAt), asc(groupLessonEnrollments.id));
  for (const candidate of waiting) {
    try {
      const promoted = await withLock(
        `booking:student:${candidate.studentUserId}`,
        8_000,
        async () => {
          if (await studentOutsideClassAge(candidate.studentUserId, lesson)) {
            return null;
          }
          if (await studentHasGroupScheduleConflict(candidate.studentUserId, lesson)) {
            return null;
          }
          const [saved] = await db
            .update(groupLessonEnrollments)
            .set({
              status: "confirmed",
              cancelledAt: null,
              cancelledByUserId: null,
              cancelReason: null,
              updatedAt: new Date(),
            })
            .where(eq(groupLessonEnrollments.id, candidate.id))
            .returning();
          await writeAuditLog({
            actor,
            action: "group_lessons.waitlist_promoted",
            entityType: "group_lesson_enrollment",
            entityId: saved.id,
            ipAddress: ip,
            metadata: {
              groupLessonId: lesson.id,
              studentUserId: candidate.studentUserId,
            },
          });
          return saved;
        },
      );
      if (promoted) return promoted;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Could not acquire lock")
      ) {
        continue;
      }
      throw err;
    }
  }
  return null;
}

export function canRevealInternalTeacherPayment(
  actor?: { roleKey: string } | null,
) {
  return Boolean(
    actor && (actor.roleKey === "teacher" || isStaffRole(actor.roleKey)),
  );
}

async function hydrateGroupLessons(
  rows: (typeof groupLessons.$inferSelect)[],
  viewerTimeZone: string,
  options?: { revealTeacherPayment?: boolean },
): Promise<GroupLessonView[]> {
  if (!rows.length) return [];
  const money = await getRequestMoney();
  const revealTeacherPayment = Boolean(options?.revealTeacherPayment);
  const rateLimits = revealTeacherPayment
    ? await getTeacherRateLimits()
    : null;
  const commissionPercent = rateLimits?.commissionPercent ?? 0;
  const commissionFixedMinor = rateLimits?.commissionFixedMinor ?? 0;
  const teacherIds = [...new Set(rows.map((row) => row.teacherUserId))];
  const subjectSlugs = [...new Set(rows.map((row) => row.subjectSlug))];
  const currencyCodes = [...new Set(rows.map((row) => row.currencyCode))];
  const [teacherRows, subjectRows, currencyRows, enrollmentRows] =
    await Promise.all([
      db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .where(inArray(users.id, teacherIds)),
      db
        .select({ slug: subjects.slug, name: subjects.name })
        .from(subjects)
        .where(inArray(subjects.slug, subjectSlugs)),
      db
        .select({
          code: currencies.code,
          symbol: currencies.symbol,
          decimalPlaces: currencies.decimalPlaces,
        })
        .from(currencies)
        .where(inArray(currencies.code, currencyCodes)),
      db
        .select({
          lessonId: groupLessonEnrollments.groupLessonId,
          status: groupLessonEnrollments.status,
        })
        .from(groupLessonEnrollments)
        .where(inArray(groupLessonEnrollments.groupLessonId, rows.map((row) => row.id))),
    ]);
  const teacherNames = new Map(teacherRows.map((row) => [row.id, row.name]));
  const subjectNames = new Map(subjectRows.map((row) => [row.slug, row.name]));
  const currencyMap = new Map(currencyRows.map((row) => [row.code, row]));

  return rows.map((row) => {
    const enrolledCount = enrollmentRows.filter(
      (item) => item.lessonId === row.id && item.status === "confirmed",
    ).length;
    const enrollment = groupClassEnrollmentStats(
      row.capacity,
      row.minStudents || DEFAULT_GROUP_MIN_STUDENTS,
      enrolledCount,
    );
    const currency = currencyMap.get(row.currencyCode);
    const converted = convertedTimeLabels(
      row.startsAt,
      viewerTimeZone,
      row.timezone,
    );
    const price = presentStudentAmount({
      amountMinor: row.amountMinor,
      listing: currency
        ? {
            code: currency.code,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
          }
        : null,
      display: money.currency,
      convert: money.convert,
      sessionCount: row.seriesTotal && row.seriesTotal > 1 ? row.seriesTotal : 1,
    });
    const teacherPaymentMinor = revealTeacherPayment
      ? (row.teacherPaymentMinor ??
        splitLessonRate(
          row.amountMinor,
          commissionPercent,
          commissionFixedMinor,
        ).teacherEarnsMinor)
      : null;
    const view = {
      id: row.id,
      teacherUserId: row.teacherUserId,
      teacherName: teacherNames.get(row.teacherUserId) ?? "Teacher",
      subjectSlug: row.subjectSlug,
      subjectName: subjectNames.get(row.subjectSlug) ?? row.subjectSlug,
      title: row.title,
      description: row.description,
      level: row.level,
      minAge: row.minAge,
      maxAge: row.maxAge,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      whenLabel: converted.viewer,
      teacherWhenLabel: converted.other,
      durationMinutes: row.durationMinutes,
      timezone: viewerTimeZone,
      teacherTimezone: row.timezone,
      capacity: row.capacity,
      minStudents: enrollment.minStudents,
      enrolledCount,
      placesLeft: enrollment.placesLeft,
      isFull: enrollment.isFull,
      waitlistCount: enrollmentRows.filter(
        (item) => item.lessonId === row.id && item.status === "waitlisted",
      ).length,
      meetsMinimum: enrollment.meetsMinimum,
      studentsNeeded: enrollment.studentsNeeded,
      isUnderEnrolled: enrollment.isUnderEnrolled,
      amountMinor: row.amountMinor,
      currencyCode: price.currencyCode,
      amountFormatted: price.studentPriceFormatted,
      studentPriceMinor: price.studentPriceMinor,
      studentPriceFormatted: price.studentPriceFormatted,
      seriesSessionCount: price.sessionCount,
      seriesTotalMinor: price.seriesTotalMinor,
      seriesTotalFormatted: price.seriesTotalFormatted,
      listedPriceFormatted: price.listedPriceFormatted,
      priceConverted: price.priceConverted,
      ...(revealTeacherPayment
        ? {
            teacherPaymentMinor,
            teacherPaymentFormatted:
              teacherPaymentMinor != null && currency
                ? formatMoneyMinor(
                    teacherPaymentMinor,
                    currency.decimalPlaces,
                    currency.symbol,
                  )
                : null,
            teacherPaymentSeriesFormatted:
              teacherPaymentMinor != null && currency
                ? formatMoneyMinor(
                    teacherPaymentMinor * price.sessionCount,
                    currency.decimalPlaces,
                    currency.symbol,
                  )
                : null,
          }
        : {}),
      seriesId: row.seriesId,
      seriesIndex: row.seriesIndex,
      seriesTotal: row.seriesTotal,
      startsOn: availabilityDate(row.startsOn),
      endsOn: availabilityDate(row.endsOn),
      weekdays: parseWeekdays(row.weekdays),
      weekInterval: row.weekInterval || 1,
      scheduleLabel: scheduleLabelFor(
        availabilityDate(row.startsOn),
        availabilityDate(row.endsOn),
        parseWeekdays(row.weekdays),
        row.weekInterval || 1,
      ),
      visibleFrom: row.visibleFrom?.toISOString() ?? null,
      visibleFromLabel: row.visibleFrom
        ? formatInTimeZone(row.visibleFrom, viewerTimeZone)
        : null,
      applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
      applicationDeadlineLabel: row.applicationDeadline
        ? formatInTimeZone(row.applicationDeadline, viewerTimeZone)
        : null,
      isVisible:
        row.status === "published" &&
        (!row.visibleFrom || row.visibleFrom.getTime() <= Date.now()),
      isOpenForEnrolment:
        row.status === "published" &&
        row.startsAt.getTime() > Date.now() &&
        (!row.visibleFrom || row.visibleFrom.getTime() <= Date.now()) &&
        (!row.applicationDeadline ||
          row.applicationDeadline.getTime() >= Date.now()),
      ...classroomJoinFields(
        "group",
        row.id,
        row.status,
        row.startsAt,
        row.endsAt,
        revealTeacherPayment ? "teacher" : undefined,
      ),
    };
    return revealTeacherPayment
      ? view
      : omitInternalTeacherPayment(view);
  });
}

const MIN_ENROLLMENT_CANCEL_REASON =
  "Cancelled because the class did not meet the minimum number of students";

async function enforceGroupClassMinimums() {
  const due = await db
    .select({
      id: groupLessons.id,
      minStudents: groupLessons.minStudents,
    })
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.status, "published"),
        isNull(groupLessons.liveCourseId),
        lte(groupLessons.startsAt, new Date()),
      ),
    )
    .limit(50);
  if (!due.length) return;
  await withLock("group-lessons:min-enrollment", 8_000, async () => {
    const counts = await db
      .select({
        lessonId: groupLessonEnrollments.groupLessonId,
        status: groupLessonEnrollments.status,
      })
      .from(groupLessonEnrollments)
      .where(
        and(
          inArray(
            groupLessonEnrollments.groupLessonId,
            due.map((row) => row.id),
          ),
          eq(groupLessonEnrollments.status, "confirmed"),
        ),
      );
    const enrolledByLesson = new Map<string, number>();
    for (const row of counts) {
      enrolledByLesson.set(row.lessonId, (enrolledByLesson.get(row.lessonId) ?? 0) + 1);
    }
    const cancelIds = due
      .filter((row) => {
        const enrolled = enrolledByLesson.get(row.id) ?? 0;
        const minimum = row.minStudents || DEFAULT_GROUP_MIN_STUDENTS;
        return enrolled < minimum;
      })
      .map((row) => row.id);
    if (!cancelIds.length) return;
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(groupLessons)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledByUserId: null,
          cancelReason: MIN_ENROLLMENT_CANCEL_REASON,
        })
        .where(
          and(
            inArray(groupLessons.id, cancelIds),
            eq(groupLessons.status, "published"),
          ),
        );
      await tx
        .update(groupLessonEnrollments)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledByUserId: null,
          cancelReason: MIN_ENROLLMENT_CANCEL_REASON,
        })
        .where(
          and(
            inArray(groupLessonEnrollments.groupLessonId, cancelIds),
            inArray(groupLessonEnrollments.status, ["confirmed", "waitlisted"]),
          ),
        );
    });
    await Promise.all(
      cancelIds.map((id) =>
        writeAuditLog({
          actor: null,
          action: "group_lessons.cancelled_min_enrollment",
          entityType: "group_lesson",
          entityId: id,
          metadata: { reason: MIN_ENROLLMENT_CANCEL_REASON },
        }),
      ),
    );
  });
}

export { publicGroupClassHref };

export type GroupClassCatalogView = {
  id: string;
  teacherUserId: string;
  teacherName: string;
  subjectName: string;
  title: string;
  durationMinutes: number;
  scheduleLabel: string | null;
  nextWhenLabel: string;
  studentPriceFormatted: string;
  listedPriceFormatted: string | null;
  seriesSessionCount: number;
  seriesTotalFormatted: string;
  sessionCount: number;
  href: string;
};

export function catalogIdForLesson(lesson: {
  id: string;
  seriesId: string | null;
}) {
  return lesson.seriesId ?? lesson.id;
}

function catalogViewFromSessions(
  sessions: GroupLessonView[],
): GroupClassCatalogView {
  const first = sessions[0]!;
  return {
    id: catalogIdForLesson(first),
    teacherUserId: first.teacherUserId,
    teacherName: first.teacherName,
    subjectName: first.subjectName,
    title: first.title,
    durationMinutes: first.durationMinutes,
    scheduleLabel: first.scheduleLabel,
    nextWhenLabel: first.whenLabel,
    studentPriceFormatted: first.studentPriceFormatted,
    listedPriceFormatted: first.listedPriceFormatted,
    seriesSessionCount: first.seriesSessionCount || sessions.length,
    seriesTotalFormatted: first.seriesTotalFormatted,
    sessionCount: sessions.length,
    href: publicGroupClassHref(first),
  };
}

export async function listPublicGroupLessons(
  viewerUserId?: string | null,
  requestedTimeZone?: string,
) {
  const timeZone = await resolveDisplayTimeZone(viewerUserId, requestedTimeZone);
  await enforceGroupClassMinimums();
  const rows = await db
    .select()
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.status, "published"),
        isNull(groupLessons.liveCourseId),
        gte(groupLessons.endsAt, new Date()),
        or(
          isNull(groupLessons.visibleFrom),
          lte(groupLessons.visibleFrom, new Date()),
        ),
      ),
    )
    .orderBy(asc(groupLessons.startsAt))
    .limit(100);
  return {
    timeZone,
    timezones: timezoneOptions(timeZone),
    lessons: await hydrateGroupLessons(rows, timeZone),
  };
}

export async function listPublicGroupClassCatalog(
  viewerUserId?: string | null,
  requestedTimeZone?: string,
) {
  const data = await listPublicGroupLessons(viewerUserId, requestedTimeZone);
  const grouped = new Map<string, GroupLessonView[]>();
  for (const lesson of data.lessons) {
    const key = catalogIdForLesson(lesson);
    const sessions = grouped.get(key) ?? [];
    sessions.push(lesson);
    grouped.set(key, sessions);
  }
  return {
    timeZone: data.timeZone,
    timezones: data.timezones,
    classes: [...grouped.values()].map(catalogViewFromSessions),
  };
}

export async function getPublicGroupClass(
  id: string,
  viewerUserId?: string | null,
  requestedTimeZone?: string,
) {
  const timeZone = await resolveDisplayTimeZone(viewerUserId, requestedTimeZone);
  await enforceGroupClassMinimums();
  const now = new Date();
  const [seed] = await db
    .select()
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.status, "published"),
        isNull(groupLessons.liveCourseId),
        or(eq(groupLessons.id, id), eq(groupLessons.seriesId, id)),
      ),
    )
    .orderBy(asc(groupLessons.startsAt))
    .limit(1);
  if (!seed) {
    return null;
  }
  if (seed.visibleFrom && seed.visibleFrom.getTime() > now.getTime()) {
    return null;
  }
  const rows = seed.seriesId
    ? await db
        .select()
        .from(groupLessons)
        .where(
          and(
            eq(groupLessons.seriesId, seed.seriesId),
            eq(groupLessons.status, "published"),
            isNull(groupLessons.liveCourseId),
          ),
        )
        .orderBy(asc(groupLessons.startsAt))
    : [seed];
  const sessions = await hydrateGroupLessons(rows, timeZone);
  if (!sessions.length) {
    return null;
  }
  return {
    timeZone,
    class: catalogViewFromSessions(sessions),
    sessions,
  };
}

export async function listTeacherGroupLessons(teacherUserId: string) {
  await enforceGroupClassMinimums();
  const timeZone = await resolveScheduleTimeZone(teacherUserId);
  const rows = await db
    .select()
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.teacherUserId, teacherUserId),
        isNull(groupLessons.liveCourseId),
      ),
    )
    .orderBy(asc(groupLessons.startsAt))
    .limit(100);
  return hydrateGroupLessons(rows, timeZone, { revealTeacherPayment: true });
}

export async function listActorGroupLessonsBetween(
  actor: ApiActor,
  from: Date,
  to: Date,
  timeZone: string,
) {
  await enforceGroupClassMinimums();
  let rows: (typeof groupLessons.$inferSelect)[];
  const dateRange = and(
    gte(groupLessons.endsAt, from),
    lt(groupLessons.startsAt, to),
  );
  if (actor.roleKey === "teacher") {
    rows = await db
      .select()
      .from(groupLessons)
      .where(and(eq(groupLessons.teacherUserId, actor.userId), dateRange))
      .orderBy(asc(groupLessons.startsAt));
  } else if (actor.roleKey === "student") {
    rows = await db
      .select({
        id: groupLessons.id,
        teacherUserId: groupLessons.teacherUserId,
        liveCourseId: groupLessons.liveCourseId,
        courseSessionIndex: groupLessons.courseSessionIndex,
        courseSessionTotal: groupLessons.courseSessionTotal,
        seriesId: groupLessons.seriesId,
        seriesIndex: groupLessons.seriesIndex,
        seriesTotal: groupLessons.seriesTotal,
        startsOn: groupLessons.startsOn,
        endsOn: groupLessons.endsOn,
        weekdays: groupLessons.weekdays,
        weekInterval: groupLessons.weekInterval,
        subjectSlug: groupLessons.subjectSlug,
        title: groupLessons.title,
        description: groupLessons.description,
        level: groupLessons.level,
        minAge: groupLessons.minAge,
        maxAge: groupLessons.maxAge,
        status: groupLessons.status,
        startsAt: groupLessons.startsAt,
        endsAt: groupLessons.endsAt,
        durationMinutes: groupLessons.durationMinutes,
        timezone: groupLessons.timezone,
        capacity: groupLessons.capacity,
        minStudents: groupLessons.minStudents,
        amountMinor: groupLessons.amountMinor,
        teacherPaymentMinor: groupLessons.teacherPaymentMinor,
        visibleFrom: groupLessons.visibleFrom,
        applicationDeadline: groupLessons.applicationDeadline,
        currencyCode: groupLessons.currencyCode,
        createdByUserId: groupLessons.createdByUserId,
        cancelledAt: groupLessons.cancelledAt,
        cancelledByUserId: groupLessons.cancelledByUserId,
        cancelReason: groupLessons.cancelReason,
        createdAt: groupLessons.createdAt,
        updatedAt: groupLessons.updatedAt,
      })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(
        and(
          eq(groupLessonEnrollments.studentUserId, actor.userId),
          eq(groupLessonEnrollments.status, "confirmed"),
          dateRange,
        ),
      )
      .orderBy(asc(groupLessons.startsAt));
  } else if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    const ids = children.map((child) => child.id);
    if (!ids.length) return [];
    rows = await db
      .select({
        id: groupLessons.id,
        teacherUserId: groupLessons.teacherUserId,
        liveCourseId: groupLessons.liveCourseId,
        courseSessionIndex: groupLessons.courseSessionIndex,
        courseSessionTotal: groupLessons.courseSessionTotal,
        seriesId: groupLessons.seriesId,
        seriesIndex: groupLessons.seriesIndex,
        seriesTotal: groupLessons.seriesTotal,
        startsOn: groupLessons.startsOn,
        endsOn: groupLessons.endsOn,
        weekdays: groupLessons.weekdays,
        weekInterval: groupLessons.weekInterval,
        subjectSlug: groupLessons.subjectSlug,
        title: groupLessons.title,
        description: groupLessons.description,
        level: groupLessons.level,
        minAge: groupLessons.minAge,
        maxAge: groupLessons.maxAge,
        status: groupLessons.status,
        startsAt: groupLessons.startsAt,
        endsAt: groupLessons.endsAt,
        durationMinutes: groupLessons.durationMinutes,
        timezone: groupLessons.timezone,
        capacity: groupLessons.capacity,
        minStudents: groupLessons.minStudents,
        amountMinor: groupLessons.amountMinor,
        teacherPaymentMinor: groupLessons.teacherPaymentMinor,
        visibleFrom: groupLessons.visibleFrom,
        applicationDeadline: groupLessons.applicationDeadline,
        currencyCode: groupLessons.currencyCode,
        createdByUserId: groupLessons.createdByUserId,
        cancelledAt: groupLessons.cancelledAt,
        cancelledByUserId: groupLessons.cancelledByUserId,
        cancelReason: groupLessons.cancelReason,
        createdAt: groupLessons.createdAt,
        updatedAt: groupLessons.updatedAt,
      })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(
        and(
          inArray(groupLessonEnrollments.studentUserId, ids),
          eq(groupLessonEnrollments.status, "confirmed"),
          dateRange,
        ),
      )
      .orderBy(asc(groupLessons.startsAt));
  } else if (
    isStaffRole(actor.roleKey) &&
    hasAnyPermission(actor, ["classes.manage", "teachers.approve"])
  ) {
    rows = await db
      .select()
      .from(groupLessons)
      .where(dateRange)
      .orderBy(asc(groupLessons.startsAt));
  } else {
    return [];
  }
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  return hydrateGroupLessons(unique, timeZone, {
    revealTeacherPayment: canRevealInternalTeacherPayment(actor),
  });
}

export async function createGroupLesson(
  actor: ApiActor,
  input: CreateGroupLessonInput,
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can publish group lessons");
  }
  return createGroupLessonForTeacher(actor, actor.userId, input, ip);
}

export async function createAdminGroupLesson(
  actor: ApiActor,
  input: AdminCreateGroupLessonInput,
  ip: string,
) {
  if (
    !isStaffRole(actor.roleKey) ||
    !hasAnyPermission(actor, "classes.manage")
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You cannot create group classes for teachers",
    );
  }
  const { teacherUserId, ...lessonInput } = input;
  return createGroupLessonForTeacher(
    actor,
    teacherUserId,
    lessonInput,
    ip,
  );
}

async function createGroupLessonForTeacher(
  actor: ApiActor,
  teacherUserId: string,
  input: CreateGroupLessonInput,
  ip: string,
) {
  const [teacher] = await db
    .select({
      status: users.status,
      verificationStatus: teacherProfiles.verificationStatus,
      currencyCode: teacherProfiles.currencyCode,
      offersGroupTeaching: teacherProfiles.offersGroupTeaching,
      defaultGroupCapacity: teacherProfiles.defaultGroupCapacity,
      defaultGroupMinStudents: teacherProfiles.defaultGroupMinStudents,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(users.id, teacherProfiles.userId))
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (
    !teacher ||
    teacher.status !== "active" ||
    teacher.verificationStatus !== "approved" ||
    !teacher.currencyCode
  ) {
    throw new ApiError(403, "LOCKED", "Complete teacher approval and pricing first");
  }
  if (!teacher.offersGroupTeaching) {
    throw new ApiError(
      403,
      "LOCKED",
      "Enable group teaching before publishing a class",
    );
  }
  const minStudents = resolveGroupMinStudents(
    input.minStudents ?? teacher.defaultGroupMinStudents,
    input.capacity,
  );
  const currencyCode = teacher.currencyCode;
  const [offered, currency] = await Promise.all([
    db
      .select({ slug: teacherSubjects.subjectSlug })
      .from(teacherSubjects)
      .where(
        and(
          eq(teacherSubjects.teacherUserId, teacherUserId),
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
  if (!offered.length) {
    throw new ApiError(422, "VALIDATION", "Choose a subject you teach");
  }
  const templateStart = new Date(input.startsAt);
  if (Number.isNaN(templateStart.getTime())) {
    throw new ApiError(422, "VALIDATION", "Choose a valid class time");
  }
  const teacherTimeZone = await resolveScheduleTimeZone(teacherUserId);
  const templateYmd = zonedYmd(templateStart, teacherTimeZone);
  const startsOn = input.startsOn || templateYmd.iso;
  const endsOn = input.endsOn || startsOn;
  if (endsOn < startsOn) {
    throw new ApiError(422, "VALIDATION", "End date must be on or after the start date");
  }
  if (isoDateDiffDays(startsOn, endsOn) > MAX_GROUP_CLASS_DAYS) {
    throw new ApiError(
      422,
      "VALIDATION",
      `Choose an end date within ${MAX_GROUP_CLASS_DAYS} days of the start date`,
    );
  }
  const weekInterval = input.weekInterval ?? 1;
  const weekdays = sortedWeekdays(
    input.weekdays?.length
      ? input.weekdays
      : [zonedWeekday(templateStart, teacherTimeZone)],
  );
  if (!weekdays.length) {
    throw new ApiError(422, "VALIDATION", "Choose at least one weekday");
  }
  const scheduledStarts = generateGroupClassStarts({
    templateStart,
    timeZone: teacherTimeZone,
    startsOn,
    endsOn,
    weekdays,
    weekInterval,
  });
  const weeksFallback = input.weeks ?? 1;
  const starts =
    input.startsOn || input.endsOn || input.weekdays?.length
      ? scheduledStarts
      : Array.from({ length: weeksFallback }, (_, index) =>
          addWeeksInZone(templateStart, teacherTimeZone, index),
        );
  if (
    !starts.length &&
    templateYmd.iso >= startsOn &&
    templateYmd.iso <= endsOn
  ) {
    starts.push(templateStart);
  }
  if (!starts.length) {
    throw new ApiError(
      422,
      "VALIDATION",
      "No class dates fall on the selected weekdays in that date range",
    );
  }
  if (starts.length > MAX_GROUP_CLASS_SESSIONS) {
    throw new ApiError(
      422,
      "VALIDATION",
      `A group class can include at most ${MAX_GROUP_CLASS_SESSIONS} sessions`,
    );
  }
  const visibleFrom = parseScheduleInstant(
    input.visibleFrom,
    teacherTimeZone,
    { hour: 0, minute: 0 },
    "Choose a valid visibility date",
  );
  let applicationDeadline = parseScheduleInstant(
    input.applicationDeadline,
    teacherTimeZone,
    { hour: 23, minute: 59 },
    "Choose a valid application deadline",
  );
  if (visibleFrom && visibleFrom.getTime() > starts[0]!.getTime()) {
    throw new ApiError(
      422,
      "VALIDATION",
      "The visibility date must be on or before the first class",
    );
  }
  if (
    applicationDeadline &&
    applicationDeadline.getTime() > starts[0]!.getTime()
  ) {
    const deadlineDay = zonedYmd(applicationDeadline, teacherTimeZone).iso;
    const firstDay = zonedYmd(starts[0]!, teacherTimeZone).iso;
    if (deadlineDay <= firstDay) {
      applicationDeadline = starts[0]!;
    } else {
      throw new ApiError(
        422,
        "VALIDATION",
        "The application deadline must be on or before the first class",
      );
    }
  }
  if (
    visibleFrom &&
    applicationDeadline &&
    visibleFrom.getTime() > applicationDeadline.getTime()
  ) {
    throw new ApiError(
      422,
      "VALIDATION",
      "The application deadline must be on or after the visibility date",
    );
  }
  const ends = starts.map(
    (start) => new Date(start.getTime() + input.durationMinutes * 60_000),
  );
  const resolvedStartsOn = zonedYmd(starts[0]!, teacherTimeZone).iso;
  const resolvedEndsOn = zonedYmd(starts[starts.length - 1]!, teacherTimeZone).iso;
  const slots = await listTeacherSlots(teacherUserId, {
    from: resolvedStartsOn,
    to: resolvedEndsOn,
    durationMinutes: input.durationMinutes,
    timeZone: teacherTimeZone,
    viewerUserId: actor.userId,
    ignoreMinNotice: true,
  });
  const openStarts = new Set(
    slots.slots.map((slot) => new Date(slot.startsAt).getTime()),
  );
  if (starts.some((start) => !openStarts.has(start.getTime()))) {
    throw new ApiError(
      409,
      "SLOT_TAKEN",
      "Every class session must be inside the teacher’s open hours",
    );
  }
  const studentPriceMajor = input.studentPriceMajor ?? input.priceMajor ?? 0;
  const decimals = currency[0]?.decimalPlaces ?? 2;
  const amountMinor = Math.round(studentPriceMajor * 10 ** decimals);
  const rateLimits = await getTeacherRateLimits();
  const commissionPercent = rateLimits.commissionPercent;
  const computedTeacherPayment = splitLessonRate(
    amountMinor,
    commissionPercent,
    rateLimits.commissionFixedMinor,
  ).teacherEarnsMinor;
  const teacherPaymentMinor =
    isStaffRole(actor.roleKey) && input.teacherPaymentMajor != null
      ? Math.round(input.teacherPaymentMajor * 10 ** decimals)
      : computedTeacherPayment;
  const savedRows = await withLock(`booking:${teacherUserId}`, 8_000, async () => {
    const [privateRows, groupRows] = await Promise.all([
      db
        .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
        .from(bookings)
        .where(
          and(
            eq(bookings.teacherUserId, teacherUserId),
            inArray(bookings.status, ["confirmed", "completed"]),
          ),
        ),
      db
        .select({ startsAt: groupLessons.startsAt, endsAt: groupLessons.endsAt })
        .from(groupLessons)
        .where(
          and(
            eq(groupLessons.teacherUserId, teacherUserId),
            eq(groupLessons.status, "published"),
          ),
        ),
    ]);
    const occupied = [...privateRows, ...groupRows];
    if (starts.some((start, index) =>
      occupied.some((row) =>
        rangesOverlap(start, ends[index]!, row.startsAt, row.endsAt),
      ),
    )) {
      throw new ApiError(409, "SLOT_TAKEN", "That time is no longer available");
    }
    const seriesId = starts.length > 1 ? randomUUID() : null;
    return db.transaction(async (tx) => {
      const created = [];
      for (const [index, start] of starts.entries()) {
        const [row] = await tx
          .insert(groupLessons)
          .values({
            teacherUserId,
            subjectSlug: input.subjectSlug,
            title: input.title,
            description: input.description || null,
            level: input.level,
            minAge: input.minAge ?? null,
            maxAge: input.maxAge ?? null,
            startsAt: start,
            endsAt: ends[index]!,
            startsOn: resolvedStartsOn,
            endsOn: resolvedEndsOn,
            weekdays: serializeWeekdays(weekdays),
            weekInterval,
            durationMinutes: input.durationMinutes,
            timezone: teacherTimeZone,
            capacity: input.capacity,
            minStudents,
            amountMinor,
            teacherPaymentMinor,
            visibleFrom,
            applicationDeadline,
            currencyCode,
            createdByUserId: actor.userId,
            seriesId,
            seriesIndex: starts.length > 1 ? index + 1 : null,
            seriesTotal: starts.length > 1 ? starts.length : null,
          })
          .returning();
        if (!row) {
          throw new ApiError(500, "INTERNAL", "Could not publish the group class");
        }
        created.push(row);
      }
      return created;
    });
  });
  if (!savedRows.length) {
    throw new ApiError(500, "INTERNAL", "Could not publish the group lesson");
  }
  await writeAuditLog({
    actor,
    action: "group_lessons.created",
    entityType: "group_lesson",
    entityId: savedRows[0]!.seriesId ?? savedRows[0]!.id,
    ipAddress: ip,
    metadata: {
      capacity: input.capacity,
      minStudents,
      studentPriceMinor: amountMinor,
      teacherPaymentMinor,
      visibleFrom: visibleFrom?.toISOString() ?? null,
      applicationDeadline: applicationDeadline?.toISOString() ?? null,
      currencyCode,
      subjectSlug: input.subjectSlug,
      level: input.level,
      minAge: input.minAge,
      maxAge: input.maxAge,
      sessions: starts.length,
      startsOn: resolvedStartsOn,
      endsOn: resolvedEndsOn,
      weekdays,
      weekInterval,
      teacherUserId,
      createdByRole: actor.roleKey,
    },
  });
  return (await hydrateGroupLessons(savedRows, teacherTimeZone, {
    revealTeacherPayment: true,
  }))[0];
}

export async function enrollGroupLesson(
  actor: ApiActor,
  groupLessonId: string,
  input: EnrollGroupLessonInput,
  ip: string,
) {
  await requireStudentForEnrollment(actor, input.studentUserId);
  await enforceGroupClassMinimums();
  return withLock(`group-lesson:${groupLessonId}`, 8_000, () =>
    withLock(`booking:student:${input.studentUserId}`, 8_000, async () => {
    const [lesson] = await db
      .select()
      .from(groupLessons)
      .where(eq(groupLessons.id, groupLessonId))
      .limit(1);
    if (
      !lesson ||
      lesson.status !== "published" ||
      lesson.startsAt.getTime() <= Date.now()
    ) {
      throw new ApiError(400, "LOCKED", "This group lesson is not open for enrolment");
    }
    if (lesson.visibleFrom && lesson.visibleFrom.getTime() > Date.now()) {
      throw new ApiError(400, "LOCKED", "This group class is not visible yet");
    }
    if (
      lesson.applicationDeadline &&
      lesson.applicationDeadline.getTime() < Date.now()
    ) {
      throw new ApiError(400, "LOCKED", "The application deadline for this class has passed");
    }
    if (lesson.minAge != null || lesson.maxAge != null) {
      const [student] = await db
        .select({ dateOfBirth: studentProfiles.dateOfBirth })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, input.studentUserId))
        .limit(1);
      if (!student?.dateOfBirth) {
        throw new ApiError(
          422,
          "VALIDATION",
          "Add the student date of birth before joining an age-restricted class",
        );
      }
      const age = ageOnDate(student.dateOfBirth, lesson.startsAt);
      if (
        (lesson.minAge != null && age < lesson.minAge) ||
        (lesson.maxAge != null && age > lesson.maxAge)
      ) {
        throw new ApiError(
          422,
          "VALIDATION",
          "This student is outside the class age range",
        );
      }
    }
    const existing = await db
      .select({
        id: groupLessonEnrollments.id,
        status: groupLessonEnrollments.status,
      })
      .from(groupLessonEnrollments)
      .where(
        and(
          eq(groupLessonEnrollments.groupLessonId, groupLessonId),
          eq(groupLessonEnrollments.studentUserId, input.studentUserId),
        ),
      )
      .limit(1);
    if (existing.length && existing[0].status === "confirmed") {
      throw new ApiError(409, "CONFLICT", "This student is already enrolled");
    }
    if (existing.length && existing[0].status !== "cancelled" && existing[0].status !== "waitlisted") {
      throw new ApiError(409, "CONFLICT", "This student already has a place for this class");
    }
    const enrolled = await db
      .select({ id: groupLessonEnrollments.id })
      .from(groupLessonEnrollments)
      .where(
        and(
          eq(groupLessonEnrollments.groupLessonId, groupLessonId),
          eq(groupLessonEnrollments.status, "confirmed"),
        ),
      );
    const claimingWaitlist =
      existing[0]?.status === "waitlisted" && enrolled.length < lesson.capacity;
    if (existing[0]?.status === "waitlisted" && !claimingWaitlist) {
      throw new ApiError(409, "CONFLICT", "This student is already on the waiting list");
    }
    const waitlisted = !claimingWaitlist && enrolled.length >= lesson.capacity;
    if (
      await studentHasGroupScheduleConflict(input.studentUserId, lesson)
    ) {
      throw new ApiError(409, "SLOT_TAKEN", "This student has another lesson at that time");
    }
    const saved = await saveGroupEnrollment({
      existingId: existing[0]?.id,
      groupLessonId,
      studentUserId: input.studentUserId,
      bookedByUserId: actor.userId,
      amountMinor: lesson.amountMinor,
      currencyCode: lesson.currencyCode,
      status: waitlisted ? "waitlisted" : "confirmed",
    });
    await writeAuditLog({
      actor,
      action: waitlisted
        ? "group_lessons.waitlisted"
        : "group_lessons.enrolled",
      entityType: "group_lesson_enrollment",
      entityId: saved.id,
      ipAddress: ip,
      metadata: { groupLessonId, studentUserId: input.studentUserId },
    });
    const timeZone = await resolveDisplayTimeZone(actor.userId);
    const [hydrated] = await hydrateGroupLessons([lesson], timeZone);
    const waitlistRows = waitlisted
      ? await db
          .select({
            id: groupLessonEnrollments.id,
            lessonId: groupLessonEnrollments.groupLessonId,
            status: groupLessonEnrollments.status,
            createdAt: groupLessonEnrollments.createdAt,
          })
          .from(groupLessonEnrollments)
          .where(
            and(
              eq(groupLessonEnrollments.groupLessonId, groupLessonId),
              eq(groupLessonEnrollments.status, "waitlisted"),
            ),
          )
      : [];
    const waitlistPosition = waitlisted
      ? (waitlistPositionMap(waitlistRows).get(saved.id) ?? hydrated.waitlistCount)
      : null;
    return {
      lesson: hydrated,
      enrollmentId: saved.id,
      status: saved.status,
      waitlistPosition,
    };
    }),
  );
}

function canManageGroupLesson(actor: ApiActor, teacherUserId: string) {
  return (
    (actor.roleKey === "teacher" && actor.userId === teacherUserId) ||
    (isStaffRole(actor.roleKey) &&
      hasAnyPermission(actor, ["classes.manage", "teachers.approve"]))
  );
}

export async function listGroupLessonRoster(actor: ApiActor, groupLessonId: string) {
  await enforceGroupClassMinimums();
  const [lesson] = await db
    .select()
    .from(groupLessons)
    .where(eq(groupLessons.id, groupLessonId))
    .limit(1);
  if (!lesson) throw new ApiError(404, "NOT_FOUND", "Group lesson not found");
  if (!canManageGroupLesson(actor, lesson.teacherUserId)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot view this class roster");
  }
  const rows = await db
    .select({
      id: groupLessonEnrollments.id,
      studentUserId: groupLessonEnrollments.studentUserId,
      studentName: users.displayName,
      status: groupLessonEnrollments.status,
      bookedByUserId: groupLessonEnrollments.bookedByUserId,
      lessonHistoryId: groupLessonEnrollments.lessonHistoryId,
      createdAt: groupLessonEnrollments.createdAt,
    })
    .from(groupLessonEnrollments)
    .innerJoin(users, eq(users.id, groupLessonEnrollments.studentUserId))
    .where(eq(groupLessonEnrollments.groupLessonId, groupLessonId));
  const positions = waitlistPositionMap(
    rows.map((row) => ({
      id: row.id,
      lessonId: groupLessonId,
      status: row.status,
      createdAt: row.createdAt,
    })),
  );
  const statusOrder = (status: string) =>
    status === "confirmed" ? 0 : status === "waitlisted" ? 1 : 2;
  return {
    lesson: (await hydrateGroupLessons([lesson], lesson.timezone, {
      revealTeacherPayment: true,
    }))[0],
    roster: rows
      .sort(
        (left, right) =>
          statusOrder(left.status) - statusOrder(right.status) ||
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.studentName.localeCompare(right.studentName),
      )
      .map((row) => ({
        id: row.id,
        studentUserId: row.studentUserId,
        studentName: row.studentName,
        status: row.status,
        bookedByUserId: row.bookedByUserId,
        lessonHistoryId: row.lessonHistoryId,
        waitlistPosition:
          row.status === "waitlisted" ? (positions.get(row.id) ?? null) : null,
      })),
  };
}

export async function listActorGroupEnrollmentIds(actor: ApiActor) {
  let studentIds: string[];
  if (actor.roleKey === "student") {
    studentIds = [actor.userId];
  } else if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    studentIds = children.map((row) => row.id);
  } else {
    return [];
  }
  if (!studentIds.length) return [];
  const rows = await db
    .select({
      id: groupLessonEnrollments.id,
      groupLessonId: groupLessonEnrollments.groupLessonId,
      studentUserId: groupLessonEnrollments.studentUserId,
      status: groupLessonEnrollments.status,
      createdAt: groupLessonEnrollments.createdAt,
    })
    .from(groupLessonEnrollments)
    .where(
      and(
        inArray(groupLessonEnrollments.studentUserId, studentIds),
        inArray(groupLessonEnrollments.status, ["confirmed", "waitlisted"]),
      ),
    );
  const lessonIds = [...new Set(rows.map((row) => row.groupLessonId))];
  const waitlistRows = lessonIds.length
    ? await db
        .select({
          id: groupLessonEnrollments.id,
          lessonId: groupLessonEnrollments.groupLessonId,
          status: groupLessonEnrollments.status,
          createdAt: groupLessonEnrollments.createdAt,
        })
        .from(groupLessonEnrollments)
        .where(
          and(
            inArray(groupLessonEnrollments.groupLessonId, lessonIds),
            eq(groupLessonEnrollments.status, "waitlisted"),
          ),
        )
    : [];
  const positions = waitlistPositionMap(waitlistRows);
  return rows.map((row) => ({
    id: row.id,
    groupLessonId: row.groupLessonId,
    studentUserId: row.studentUserId,
    status: row.status,
    waitlistPosition:
      row.status === "waitlisted" ? (positions.get(row.id) ?? null) : null,
  }));
}

export async function cancelGroupLesson(
  actor: ApiActor,
  groupLessonId: string,
  reason: string | undefined,
  ip: string,
) {
  const [lesson] = await db
    .select()
    .from(groupLessons)
    .where(eq(groupLessons.id, groupLessonId))
    .limit(1);
  if (!lesson) throw new ApiError(404, "NOT_FOUND", "Group lesson not found");
  if (!canManageGroupLesson(actor, lesson.teacherUserId)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot cancel this group lesson");
  }
  if (lesson.status !== "published") {
    throw new ApiError(400, "LOCKED", "Only a published group lesson can be cancelled");
  }
  if (lesson.startsAt.getTime() <= Date.now()) {
    throw new ApiError(400, "LOCKED", "A group class cannot be cancelled after it starts");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(groupLessons)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: actor.userId,
        cancelReason: reason?.trim() || null,
      })
      .where(eq(groupLessons.id, groupLessonId));
    await tx
      .update(groupLessonEnrollments)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: actor.userId,
        cancelReason: reason?.trim() || "Group lesson cancelled",
      })
      .where(
        and(
          eq(groupLessonEnrollments.groupLessonId, groupLessonId),
          inArray(groupLessonEnrollments.status, ["confirmed", "waitlisted"]),
        ),
      );
  });
  await writeAuditLog({
    actor,
    action: "group_lessons.cancelled",
    entityType: "group_lesson",
    entityId: groupLessonId,
    ipAddress: ip,
    metadata: { reason: reason?.trim() || null },
  });
  return { id: groupLessonId, status: "cancelled" as const };
}

export async function cancelGroupLessonSeries(
  actor: ApiActor,
  groupLessonId: string,
  reason: string | undefined,
  ip: string,
) {
  const [selected] = await db
    .select()
    .from(groupLessons)
    .where(eq(groupLessons.id, groupLessonId))
    .limit(1);
  if (!selected) throw new ApiError(404, "NOT_FOUND", "Group class not found");
  if (!canManageGroupLesson(actor, selected.teacherUserId)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot cancel this class series");
  }
  if (!selected.seriesId) {
    throw new ApiError(400, "VALIDATION", "This is a single group class");
  }
  if (selected.startsAt.getTime() <= Date.now()) {
    throw new ApiError(400, "LOCKED", "A class cannot be cancelled after it starts");
  }
  const rows = await db
    .select({ id: groupLessons.id })
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.seriesId, selected.seriesId),
        eq(groupLessons.status, "published"),
        gte(groupLessons.startsAt, selected.startsAt),
      ),
    );
  if (!rows.length) {
    throw new ApiError(400, "LOCKED", "No remaining classes to cancel");
  }
  const ids = rows.map((row) => row.id);
  const note = reason?.trim() || "Group class series cancelled";
  await withLock(`booking:${selected.teacherUserId}`, 8_000, () =>
    db.transaction(async (tx) => {
      await tx
        .update(groupLessons)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledByUserId: actor.userId,
          cancelReason: note,
        })
        .where(
          and(
            inArray(groupLessons.id, ids),
            eq(groupLessons.status, "published"),
          ),
        );
      await tx
        .update(groupLessonEnrollments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledByUserId: actor.userId,
          cancelReason: note,
        })
        .where(
          and(
            inArray(groupLessonEnrollments.groupLessonId, ids),
            inArray(groupLessonEnrollments.status, ["confirmed", "waitlisted"]),
          ),
        );
    }),
  );
  await writeAuditLog({
    actor,
    action: "group_lessons.series_cancelled",
    entityType: "group_lesson_series",
    entityId: selected.seriesId,
    ipAddress: ip,
    metadata: { fromGroupLessonId: groupLessonId, cancelledCount: ids.length },
  });
  return { seriesId: selected.seriesId, cancelledIds: ids };
}

export async function cancelGroupEnrollment(
  actor: ApiActor,
  groupLessonId: string,
  enrollmentId: string,
  reason: string | undefined,
  ip: string,
) {
  const result = await withLock(`group-lesson:${groupLessonId}`, 8_000, async () => {
    const [row] = await db
      .select({
        enrollment: groupLessonEnrollments,
        lesson: groupLessons,
      })
      .from(groupLessonEnrollments)
      .innerJoin(
        groupLessons,
        eq(groupLessons.id, groupLessonEnrollments.groupLessonId),
      )
      .where(
        and(
          eq(groupLessonEnrollments.id, enrollmentId),
          eq(groupLessonEnrollments.groupLessonId, groupLessonId),
        ),
      )
      .limit(1);
    if (!row) throw new ApiError(404, "NOT_FOUND", "Enrollment not found");
    const allowed =
      actor.userId === row.enrollment.studentUserId ||
      actor.userId === row.enrollment.bookedByUserId ||
      canManageGroupLesson(actor, row.lesson.teacherUserId);
    if (!allowed) {
      throw new ApiError(403, "FORBIDDEN", "You cannot cancel this enrollment");
    }
    if (
      row.enrollment.status !== "confirmed" &&
      row.enrollment.status !== "waitlisted"
    ) {
      throw new ApiError(
        400,
        "LOCKED",
        "Only a reserved place or waiting-list place can be cancelled",
      );
    }
    const leavingWaitlist = row.enrollment.status === "waitlisted";
    await db
      .update(groupLessonEnrollments)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: actor.userId,
        cancelReason: reason?.trim() || null,
      })
      .where(eq(groupLessonEnrollments.id, enrollmentId));
    const promoted =
      !leavingWaitlist && row.lesson.status === "published"
        ? await promoteNextWaitlisted(row.lesson, actor, ip)
        : null;
    await writeAuditLog({
      actor,
      action: leavingWaitlist
        ? "group_lessons.waitlist_left"
        : "group_lessons.enrollment_cancelled",
      entityType: "group_lesson_enrollment",
      entityId: enrollmentId,
      ipAddress: ip,
      metadata: { groupLessonId },
    });
    const timeZone = await resolveDisplayTimeZone(actor.userId);
    const [hydrated] = await hydrateGroupLessons([row.lesson], timeZone);
    return {
      id: enrollmentId,
      status: "cancelled" as const,
      lesson: hydrated,
      promotedEnrollmentId: promoted?.id ?? null,
      notify:
        promoted
          ? ("reserved" as const)
          : !leavingWaitlist &&
              hydrated.placesLeft > 0 &&
              hydrated.waitlistCount > 0
            ? ("available" as const)
            : null,
    };
  });
  try {
    if (result.notify === "reserved" && result.promotedEnrollmentId) {
      await notifyGroupPlaceReserved(result.promotedEnrollmentId);
    } else if (result.notify === "available") {
      await notifyGroupPlaceAvailable(groupLessonId);
    }
  } catch (error) {
    console.error("group_place_notification_failed", {
      groupLessonId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  return result;
}

export async function completeGroupEnrollment(
  actor: ApiActor,
  groupLessonId: string,
  enrollmentId: string,
  status: "completed" | "no_show",
  notes: string | undefined,
  ip: string,
) {
  const [row] = await db
    .select({
      enrollment: groupLessonEnrollments,
      lesson: groupLessons,
      subjectName: subjects.name,
    })
    .from(groupLessonEnrollments)
    .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
    .innerJoin(subjects, eq(subjects.slug, groupLessons.subjectSlug))
    .where(
      and(
        eq(groupLessonEnrollments.id, enrollmentId),
        eq(groupLessonEnrollments.groupLessonId, groupLessonId),
      ),
    )
    .limit(1);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Enrollment not found");
  await enforceGroupClassMinimums();
  const [lesson] = await db
    .select({
      status: groupLessons.status,
      cancelReason: groupLessons.cancelReason,
    })
    .from(groupLessons)
    .where(eq(groupLessons.id, groupLessonId))
    .limit(1);
  if (!lesson || (lesson.status !== "published" && lesson.status !== "completed")) {
    throw new ApiError(
      400,
      "LOCKED",
      lesson?.cancelReason === MIN_ENROLLMENT_CANCEL_REASON
        ? "This class was cancelled because it did not meet the minimum number of students"
        : "This class is no longer open for attendance",
    );
  }
  if (!canManageGroupLesson(actor, row.lesson.teacherUserId)) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher or staff can record attendance");
  }
  if (row.enrollment.status !== "confirmed") {
    throw new ApiError(400, "LOCKED", "Attendance has already been recorded");
  }
  if (row.lesson.endsAt.getTime() > Date.now()) {
    throw new ApiError(400, "LOCKED", "Wait until the group lesson has ended");
  }
  await db.transaction(async (tx) => {
    const attendedMinutes = await attendedMinutesForRecord({
      studentUserId: row.enrollment.studentUserId,
      groupLessonId: groupLessonId,
      scheduledMinutes: row.lesson.durationMinutes,
      status,
    });
    const [history] = await tx
      .insert(lessonHistory)
      .values({
        studentUserId: row.enrollment.studentUserId,
        teacherUserId: row.lesson.teacherUserId,
        subjectSlug: row.lesson.subjectSlug,
        title: defaultLessonTitle(row.subjectName),
        status,
        startedAt: row.lesson.startsAt,
        durationMinutes: row.lesson.durationMinutes,
        attendedMinutes,
        notes: notes?.trim() || null,
        recordedByUserId: actor.userId,
      })
      .returning();
    await tx
      .update(groupLessonEnrollments)
      .set({ status, lessonHistoryId: history?.id ?? null })
      .where(eq(groupLessonEnrollments.id, enrollmentId));
  });
  const remaining = await db
    .select({ id: groupLessonEnrollments.id })
    .from(groupLessonEnrollments)
    .where(
      and(
        eq(groupLessonEnrollments.groupLessonId, groupLessonId),
        eq(groupLessonEnrollments.status, "confirmed"),
      ),
    )
    .limit(1);
  if (!remaining.length) {
    await db
      .update(groupLessons)
      .set({ status: "completed" })
      .where(eq(groupLessons.id, groupLessonId));
  }
  await writeAuditLog({
    actor,
    action: `group_lessons.enrollment_${status}`,
    entityType: "group_lesson_enrollment",
    entityId: enrollmentId,
    ipAddress: ip,
    metadata: { groupLessonId },
  });
  return { id: enrollmentId, status };
}
