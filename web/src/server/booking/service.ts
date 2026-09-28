import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  bookingEvents,
  bookingPackages,
  bookings,
  currencies,
  financeOperations,
  groupLessons,
  lessonHistory,
  parentChildren,
  studentProfiles,
  subjects,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { sendAccountEmail } from "@/server/auth/mail";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import {
  bookingKindLabel,
  bookingStatusLabel,
  BOOKING_HORIZON_DAYS,
  cancelOutcomeLabel,
  LESSON_FORMAT_ONE_TO_ONE,
  isSupportedLessonDuration,
  lessonDurationOptions,
  MAX_RECURRING_WEEKS,
  PACKAGE_OPTIONS,
  rangesOverlap,
  type BookingView,
  type BookingChangeRecordView,
  type CancelOutcome,
} from "@/lib/booking";
import { classroomJoinFields } from "@/lib/classroom";
import { attendedMinutesForRecord } from "@/server/classroom/attendance";
import { timezoneOptions } from "@/lib/geo";
import { defaultLessonTitle } from "@/lib/lesson-history";
import { withLock } from "@/redis/locks";
import {
  addCalendarDays,
  convertedTimeLabels,
  DEFAULT_TIMEZONE,
  formatInTimeZone,
  zonedHms,
  zonedLocalToUtc,
  zonedYmd,
} from "@/lib/timezone";
import { getRequestMoney } from "@/server/money/currency";
import { listParentChildren } from "@/server/parent/children";
import { getBookingPolicy, resolveDisplayTimeZone, resolveScheduleTimeZone, resolveTeacherMinNotice, assertBookingMinNotice, resolveUserTimeZones } from "./policy";
import { listTeacherSlots, listOpenBookings } from "./slots";
import type {
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
} from "./schemas";

function isLockError(error: unknown) {
  return error instanceof Error && error.message.includes("Could not acquire lock");
}

async function requireStudentForBooker(actor: ApiActor, studentUserId: string) {
  if (actor.roleKey === "student") {
    if (actor.userId !== studentUserId) {
      throw new ApiError(403, "FORBIDDEN", "You can only book lessons for yourself");
    }
    const [student] = await db
      .select({ parentManaged: studentProfiles.parentManaged })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, studentUserId))
      .limit(1);
    if (!student || student.parentManaged) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "This student is managed by a parent. Book from the family account.",
      );
    }
    return;
  }

  if (actor.roleKey === "parent") {
    const [link] = await db
      .select({ id: parentChildren.id })
      .from(parentChildren)
      .innerJoin(users, eq(parentChildren.childUserId, users.id))
      .where(
        and(
          eq(parentChildren.parentUserId, actor.userId),
          eq(parentChildren.childUserId, studentUserId),
        ),
      )
      .limit(1);
    if (!link) {
      throw new ApiError(403, "FORBIDDEN", "That child is not on your family account");
    }
    return;
  }

  throw new ApiError(403, "FORBIDDEN", "Only a parent or student can create a booking");
}

async function loadTeacherForBooking(teacherUserId: string) {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      verificationStatus: teacherProfiles.verificationStatus,
      hourlyRateMinor: teacherProfiles.hourlyRateMinor,
      currencyCode: teacherProfiles.currencyCode,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (!row || row.verificationStatus !== "approved" || row.status !== "active") {
    throw new ApiError(400, "LOCKED", "This teacher is not available to book");
  }
  if (!row.hourlyRateMinor || !row.currencyCode) {
    throw new ApiError(400, "LOCKED", "This teacher has not listed a lesson rate yet");
  }
  return row;
}

function prorate(hourlyMinor: number, durationMinutes: number) {
  return Math.max(1, Math.round((hourlyMinor * durationMinutes) / 60));
}

async function assertTrialEligible(teacherUserId: string, studentUserId: string) {
  const [previousTrial] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.teacherUserId, teacherUserId),
        eq(bookings.studentUserId, studentUserId),
        eq(bookings.kind, "trial"),
        inArray(bookings.status, ["confirmed", "completed", "no_show"]),
      ),
    )
    .limit(1);
  if (previousTrial) {
    throw new ApiError(
      409,
      "CONFLICT",
      "This student has already used a trial lesson with this teacher",
    );
  }
}

function addWeeksInZone(start: Date, timeZone: string, weeks: number) {
  const ymd = zonedYmd(start, timeZone);
  const clock = zonedHms(start, timeZone);
  const nextIso = addCalendarDays(ymd.iso, weeks * 7);
  const [year, month, day] = nextIso.split("-").map(Number);
  return zonedLocalToUtc(timeZone, year, month, day, clock.hour, clock.minute);
}

export async function publicBookingView(
  row: typeof bookings.$inferSelect,
  extras: {
    teacherName: string;
    studentName: string;
    subjectName: string | null;
    timeZone: string;
    teacherTimeZone?: string | null;
    amountFormatted: string | null;
    listedPriceFormatted?: string | null;
    priceConverted?: boolean;
    packageDiscountPercent?: number | null;
    packageTotalFormatted?: string | null;
    packageListedTotalFormatted?: string | null;
    cancelFinancialStatus?: string | null;
  },
): Promise<BookingView> {
  const converted = convertedTimeLabels(row.startsAt, extras.timeZone, extras.teacherTimeZone);
  return {
    id: row.id,
    teacherUserId: row.teacherUserId,
    teacherName: extras.teacherName,
    studentUserId: row.studentUserId,
    studentName: extras.studentName,
    bookedByUserId: row.bookedByUserId,
    subjectSlug: row.subjectSlug,
    subjectName: extras.subjectName,
    kind: row.kind,
    kindLabel: bookingKindLabel(row.kind),
    bookingMode: row.packageId ? "package" : row.seriesId ? "recurring" : "single",
    bookingModeLabel: row.packageId
      ? "Lesson package"
      : row.seriesId
        ? "Recurring booking"
        : "Single booking",
    format: LESSON_FORMAT_ONE_TO_ONE,
    formatLabel: "One-to-one",
    status: row.status,
    statusLabel: bookingStatusLabel(row.status),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    whenLabel: converted.viewer,
    teacherWhenLabel: converted.other,
    durationMinutes: row.durationMinutes,
    timezone: extras.timeZone,
    teacherTimezone: extras.teacherTimeZone ?? extras.timeZone,
    seriesId: row.seriesId,
    seriesIndex: row.seriesIndex,
    seriesTotal: row.seriesTotal,
    packageId: row.packageId,
    packageDiscountPercent: extras.packageDiscountPercent ?? null,
    packageTotalFormatted: extras.packageTotalFormatted ?? null,
    packageListedTotalFormatted: extras.packageListedTotalFormatted ?? null,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    amountFormatted: extras.amountFormatted,
    listedPriceFormatted: extras.listedPriceFormatted ?? null,
    priceConverted: extras.priceConverted ?? false,
    cancelOutcome: row.cancelOutcome,
    cancelOutcomeLabel: cancelOutcomeLabel(row.cancelOutcome),
    cancelReason: row.cancelReason,
    cancelFinancialAction: row.cancelFinancialAction,
    cancelFinancialStatus: extras.cancelFinancialStatus ?? null,
    cancelFinancialLabel: row.cancelFinancialAction
      ? `${row.cancelFinancialAction.replaceAll("_", " ")} · ${
          extras.cancelFinancialStatus ?? "completed"
        }`
      : null,
    ...classroomJoinFields(
      "booking",
      row.id,
      row.status,
      row.startsAt,
      row.endsAt,
    ),
  };
}

export async function listTeacherBookingsBetween(
  teacherUserId: string,
  from: Date,
  to: Date,
  timeZone: string,
) {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.teacherUserId, teacherUserId),
        gte(bookings.endsAt, from),
        lt(bookings.startsAt, to),
      ),
    )
    .orderBy(asc(bookings.startsAt));
  return hydrateBookings(rows, timeZone);
}

async function actorBookingScope(actor: ApiActor) {
  if (actor.roleKey === "teacher") {
    return eq(bookings.teacherUserId, actor.userId);
  }
  if (actor.roleKey === "student") {
    return eq(bookings.studentUserId, actor.userId);
  }
  if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    const studentIds = children.map((item) => item.id);
    return studentIds.length
      ? inArray(bookings.studentUserId, studentIds)
      : eq(bookings.bookedByUserId, actor.userId);
  }
  if (isStaffRole(actor.roleKey)) {
    if (!hasAnyPermission(actor, ["classes.manage", "teachers.approve"])) {
      throw new ApiError(403, "FORBIDDEN", "You cannot view these bookings");
    }
    return null;
  }
  throw new ApiError(403, "FORBIDDEN", "You cannot view these bookings");
}

export async function listActorBookingsBetween(
  actor: ApiActor,
  from: Date,
  to: Date,
  timeZone: string,
) {
  const scope = await actorBookingScope(actor);
  const rows = await db
    .select()
    .from(bookings)
    .where(
      scope
        ? and(scope, gte(bookings.endsAt, from), lt(bookings.startsAt, to))
        : and(gte(bookings.endsAt, from), lt(bookings.startsAt, to)),
    )
    .orderBy(asc(bookings.startsAt))
    .limit(400);
  return hydrateBookings(rows, timeZone);
}

async function hydrateBookings(
  rows: (typeof bookings.$inferSelect)[],
  timeZone: string,
) {
  if (!rows.length) {
    return [];
  }
  const teacherIds = [...new Set(rows.map((row) => row.teacherUserId))];
  const studentIds = [...new Set(rows.map((row) => row.studentUserId))];
  const slugs = [...new Set(rows.map((row) => row.subjectSlug))];
  const codes = [...new Set(rows.map((row) => row.currencyCode))];
  const packageIds = rows
    .map((row) => row.packageId)
    .filter((id): id is string => Boolean(id));
  const financeOperationIds = rows
    .map((row) => row.cancelFinanceOperationId)
    .filter((id): id is string => Boolean(id));
  const displayMoney = await getRequestMoney();
  const [teacherRows, studentRows, subjectRows, currencyRows, teacherZones, packageRows, financeRows] = await Promise.all([
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, teacherIds)),
    db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, studentIds)),
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(inArray(subjects.slug, slugs)),
    db
      .select({
        code: currencies.code,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
      })
      .from(currencies)
      .where(inArray(currencies.code, codes)),
    resolveUserTimeZones(teacherIds),
    packageIds.length
      ? db
          .select()
          .from(bookingPackages)
          .where(inArray(bookingPackages.id, packageIds))
      : Promise.resolve([]),
    financeOperationIds.length
      ? db
          .select({
            id: financeOperations.id,
            status: financeOperations.status,
          })
          .from(financeOperations)
          .where(inArray(financeOperations.id, financeOperationIds))
      : Promise.resolve([]),
  ]);
  const teachers = new Map(teacherRows.map((row) => [row.id, row.displayName]));
  const students = new Map(studentRows.map((row) => [row.id, row.displayName]));
  const names = new Map(subjectRows.map((row) => [row.slug, row.name]));
  const money = new Map(currencyRows.map((row) => [row.code, row]));
  const packages = new Map(packageRows.map((row) => [row.id, row]));
  const financeStatuses = new Map(
    financeRows.map((row) => [row.id, row.status]),
  );
  return Promise.all(
    rows.map((row) => {
      const currency = money.get(row.currencyCode);
      const lessonPackage = row.packageId ? packages.get(row.packageId) : null;
      const listing = currency
        ? {
            code: currency.code,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
          }
        : null;
      const price = presentStudentAmount({
        amountMinor: row.amountMinor,
        listing,
        display: displayMoney.currency,
        convert: displayMoney.convert,
      });
      const packagePrice =
        lessonPackage && listing
          ? presentStudentAmount({
              amountMinor: lessonPackage.totalAmountMinor,
              listing,
              display: displayMoney.currency,
              convert: displayMoney.convert,
            })
          : null;
      return publicBookingView(row, {
        teacherName: teachers.get(row.teacherUserId) ?? "Teacher",
        studentName: students.get(row.studentUserId) ?? "Student",
        subjectName: names.get(row.subjectSlug) ?? null,
        timeZone,
        teacherTimeZone: teacherZones.get(row.teacherUserId) ?? null,
        amountFormatted: price.studentPriceFormatted,
        listedPriceFormatted: price.listedPriceFormatted,
        priceConverted: price.priceConverted,
        packageDiscountPercent: lessonPackage?.discountPercent ?? null,
        packageTotalFormatted: packagePrice?.studentPriceFormatted ?? null,
        packageListedTotalFormatted: packagePrice?.listedPriceFormatted ?? null,
        cancelFinancialStatus: row.cancelFinanceOperationId
          ? financeStatuses.get(row.cancelFinanceOperationId) ?? null
          : row.cancelFinancialAction
            ? row.cancelFinancialAction === "none"
              ? "not_required"
              : "completed"
            : null,
      });
    }),
  );
}

async function hydrateBookingChangeRecords(
  rows: (typeof bookings.$inferSelect)[],
  views: BookingView[],
  timeZone: string,
) {
  if (!rows.length) {
    return {
      teacher: [] as BookingChangeRecordView[],
      student: [] as BookingChangeRecordView[],
    };
  }
  const eventRows = await db
    .select({
      event: bookingEvents,
      actorName: users.displayName,
    })
    .from(bookingEvents)
    .leftJoin(users, eq(users.id, bookingEvents.actorUserId))
    .where(
      and(
        inArray(
          bookingEvents.bookingId,
          rows.map((row) => row.id),
        ),
        inArray(bookingEvents.kind, ["cancelled", "rescheduled"]),
      ),
    )
    .orderBy(desc(bookingEvents.createdAt))
    .limit(240);
  const bookingById = new Map(views.map((view) => [view.id, view]));
  const records = eventRows.flatMap(({ event, actorName }) => {
    const booking = bookingById.get(event.bookingId);
    if (!booking || (event.kind !== "cancelled" && event.kind !== "rescheduled")) {
      return [];
    }
    const side =
      event.actorRole === "teacher" || isStaffRole(event.actorRole)
        ? "teacher"
        : "student";
    return [
      {
        id: event.id,
        bookingId: event.bookingId,
        side,
        actorRole: event.actorRole,
        actorName: actorName ?? event.actorRole,
        kind: event.kind,
        occurredAt: event.createdAt.toISOString(),
        occurredLabel: formatInTimeZone(event.createdAt, timeZone),
        lessonLabel: booking.whenLabel,
        teacherName: booking.teacherName,
        studentName: booking.studentName,
        fromLabel: event.fromStartsAt
          ? formatInTimeZone(event.fromStartsAt, timeZone)
          : null,
        toLabel: event.toStartsAt
          ? formatInTimeZone(event.toStartsAt, timeZone)
          : null,
        reason: event.note,
        outcomeLabel: cancelOutcomeLabel(event.outcome),
        financialLabel: booking.cancelFinancialLabel,
        financialAction: booking.cancelFinancialAction,
        financialStatus: booking.cancelFinancialStatus,
      } satisfies BookingChangeRecordView,
    ];
  });
  return {
    teacher: records.filter((record) => record.side === "teacher").slice(0, 60),
    student: records.filter((record) => record.side === "student").slice(0, 60),
  };
}

export async function listActorBookings(actor: ApiActor) {
  const timeZone = await resolveDisplayTimeZone(actor.userId);
  let rows: (typeof bookings.$inferSelect)[] = [];

  if (actor.roleKey === "teacher") {
    rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.teacherUserId, actor.userId))
      .orderBy(desc(bookings.startsAt))
      .limit(80);
  } else if (actor.roleKey === "student") {
    rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.studentUserId, actor.userId))
      .orderBy(desc(bookings.startsAt))
      .limit(80);
  } else if (actor.roleKey === "parent") {
    const children = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    const studentIds = children.map((item) => item.id);
    rows = await db
      .select()
      .from(bookings)
      .where(
        studentIds.length
          ? inArray(bookings.studentUserId, studentIds)
          : eq(bookings.bookedByUserId, actor.userId),
      )
      .orderBy(desc(bookings.startsAt))
      .limit(80);
  } else if (isStaffRole(actor.roleKey)) {
    if (!hasAnyPermission(actor, ["classes.manage", "teachers.approve"])) {
      throw new ApiError(403, "FORBIDDEN", "You cannot view these bookings");
    }
    return listStaffBookings(timeZone);
  } else {
    throw new ApiError(403, "FORBIDDEN", "You cannot view these bookings");
  }

  const hydrated = await hydrateBookings(rows, timeZone);
  return {
    timeZone,
    timezones: timezoneOptions(timeZone),
    bookings: hydrated,
    changeRecords: await hydrateBookingChangeRecords(rows, hydrated, timeZone),
  };
}

export async function listStaffBookings(timeZone = DEFAULT_TIMEZONE) {
  const rows = await db
    .select()
    .from(bookings)
    .orderBy(desc(bookings.startsAt))
    .limit(120);
  const hydrated = await hydrateBookings(rows, timeZone);
  return {
    timeZone,
    timezones: timezoneOptions(timeZone),
    bookings: hydrated,
    changeRecords: await hydrateBookingChangeRecords(rows, hydrated, timeZone),
  };
}

export async function listUpcomingLessons(actor: ApiActor, limit = 3) {
  const timeZone = await resolveDisplayTimeZone(actor.userId);
  const scope = await actorBookingScope(actor);
  const filters = [
    eq(bookings.status, "confirmed"),
    gte(bookings.startsAt, new Date()),
  ];
  if (scope) {
    filters.unshift(scope);
  }
  const rows = await db
    .select()
    .from(bookings)
    .where(and(...filters))
    .orderBy(asc(bookings.startsAt))
    .limit(Math.max(1, Math.min(12, limit)));
  return hydrateBookings(rows, timeZone);
}

export async function getActorBooking(actor: ApiActor, id: string) {
  const row = await loadBooking(id);
  if (!canManage(actor, row)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot view this lesson");
  }
  const timeZone = await resolveDisplayTimeZone(actor.userId);
  const [view] = await hydrateBookings([row], timeZone);
  return view;
}

async function assertSlotOpen(
  teacherUserId: string,
  studentUserId: string,
  startsAt: Date,
  endsAt: Date,
  ignoreBookingIds: string[] = [],
) {
  const ignoredIds = new Set(ignoreBookingIds);
  const occupied = await listOpenBookings(
    teacherUserId,
    new Date(startsAt.getTime() - 12 * 60 * 60 * 1000),
    new Date(endsAt.getTime() + 12 * 60 * 60 * 1000),
  );
  const clash = occupied.find(
    (row) =>
      !ignoredIds.has(row.id) &&
      rangesOverlap(startsAt, endsAt, row.startsAt, row.endsAt),
  );
  if (clash) {
    throw new ApiError(409, "SLOT_TAKEN", "That time is no longer available");
  }
  const groupRows = await db
    .select({
      id: groupLessons.id,
      startsAt: groupLessons.startsAt,
      endsAt: groupLessons.endsAt,
    })
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.teacherUserId, teacherUserId),
        eq(groupLessons.status, "published"),
      ),
    );
  if (
    groupRows.some((row) =>
      rangesOverlap(startsAt, endsAt, row.startsAt, row.endsAt),
    )
  ) {
    throw new ApiError(409, "SLOT_TAKEN", "That time has a group lesson");
  }

  const studentRows = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.studentUserId, studentUserId),
        inArray(bookings.status, ["confirmed", "completed"]),
      ),
    );
  if (
    studentRows.some(
      (row) =>
        !ignoredIds.has(row.id) &&
        rangesOverlap(startsAt, endsAt, row.startsAt, row.endsAt),
    )
  ) {
    throw new ApiError(
      409,
      "SLOT_TAKEN",
      "This student already has a lesson at that time",
    );
  }
}

export async function createBookings(
  actor: ApiActor,
  input: CreateBookingInput,
  ip: string,
) {
  await requireStudentForBooker(actor, input.studentUserId);
  const teacher = await loadTeacherForBooking(input.teacherUserId);
  const notice = await resolveTeacherMinNotice(teacher.userId);
  const policy = notice.policy;
  const teacherZone = await resolveScheduleTimeZone(teacher.userId);
  const viewerZone = await resolveDisplayTimeZone(actor.userId, input.timeZone);
  const duration =
    input.kind === "trial"
      ? policy.trialDurationMinutes
      : input.durationMinutes ?? policy.lessonDurationMinutes;
  if (
    input.kind !== "trial" &&
    !isSupportedLessonDuration(duration, policy.lessonDurationMinutes)
  ) {
    throw new ApiError(422, "VALIDATION", "Choose a supported lesson length");
  }
  const bookingMode =
    input.kind === "trial"
      ? "single"
      : input.bookingMode ??
        ((input.weeks ?? 1) > 1 ? "recurring" : "single");
  const packageOption =
    bookingMode === "package"
      ? PACKAGE_OPTIONS.find((option) => option.lessons === input.packageSize)
      : null;
  if (bookingMode === "package" && !packageOption) {
    throw new ApiError(422, "VALIDATION", "Choose a supported lesson package");
  }
  const weeks =
    bookingMode === "single"
      ? 1
      : bookingMode === "package"
        ? packageOption!.lessons
      : Math.min(MAX_RECURRING_WEEKS, Math.max(2, input.weeks ?? 2));
  if (input.kind === "trial" && weeks > 1) {
    throw new ApiError(422, "VALIDATION", "A trial lesson is a single booking");
  }
  if (input.kind === "trial") {
    await assertTrialEligible(teacher.userId, input.studentUserId);
  }
  if (
    bookingMode !== "single" &&
    weeks < notice.commitment.effectiveLessons
  ) {
    throw new ApiError(
      422,
      "VALIDATION",
      `This teacher requires at least ${notice.commitment.effectiveLessons} lesson${notice.commitment.effectiveLessons === 1 ? "" : "s"}`,
    );
  }

  const [teaches] = await db
    .select({ slug: teacherSubjects.subjectSlug })
    .from(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.teacherUserId, teacher.userId),
        eq(teacherSubjects.subjectSlug, input.subjectSlug),
      ),
    )
    .limit(1);
  if (!teaches) {
    throw new ApiError(422, "VALIDATION", "Choose a subject this teacher offers");
  }

  const firstStart = new Date(input.startsAt);
  if (Number.isNaN(firstStart.getTime())) {
    throw new ApiError(422, "VALIDATION", "Choose a valid start time");
  }
  assertBookingMinNotice(firstStart, notice.effectiveMinutes);

  const lastStart = addWeeksInZone(firstStart, teacherZone, weeks - 1);
  const available = await listTeacherSlots(teacher.userId, {
    durationMinutes: duration,
    viewerUserId: actor.userId,
    timeZone: viewerZone,
    from: zonedYmd(firstStart, teacherZone).iso,
    to: zonedYmd(lastStart, teacherZone).iso,
  });
  const starts: Date[] = [];
  for (let week = 0; week < weeks; week += 1) {
    const start = week === 0 ? firstStart : addWeeksInZone(firstStart, teacherZone, week);
    const match = available.slots.find(
      (slot) => new Date(slot.startsAt).getTime() === start.getTime(),
    );
    if (!match && week === 0) {
      throw new ApiError(409, "SLOT_TAKEN", "That time is no longer available");
    }
    if (!match) {
      throw new ApiError(
        409,
        "SLOT_TAKEN",
        `Week ${week + 1} is not available at the same local time`,
      );
    }
    starts.push(start);
  }

  const seriesId = weeks > 1 ? randomUUID() : null;
  const standardAmountMinor = prorate(teacher.hourlyRateMinor!, duration);
  const amountMinor =
    input.kind === "trial"
      ? Math.max(
          policy.trialPricePercent === 0 ? 0 : 1,
          Math.round((standardAmountMinor * policy.trialPricePercent) / 100),
        )
      : bookingMode === "package"
        ? Math.max(
            1,
            Math.round(
              (standardAmountMinor * (100 - packageOption!.discountPercent)) / 100,
            ),
          )
        : standardAmountMinor;
  const packageTotalMinor =
    bookingMode === "package" ? amountMinor * weeks : null;

  try {
    const created = await withLock(`booking:${teacher.userId}`, 8_000, async () => {
      return withLock(`booking:student:${input.studentUserId}`, 8_000, () =>
        db.transaction(async (tx) => {
        if (input.kind === "trial") {
          await assertTrialEligible(teacher.userId, input.studentUserId);
        }
        let packageId: string | null = null;
        if (bookingMode === "package") {
          const [lessonPackage] = await tx
            .insert(bookingPackages)
            .values({
              teacherUserId: teacher.userId,
              studentUserId: input.studentUserId,
              bookedByUserId: actor.userId,
              subjectSlug: input.subjectSlug,
              lessonCount: weeks,
              discountPercent: packageOption!.discountPercent,
              perLessonAmountMinor: amountMinor,
              totalAmountMinor: packageTotalMinor!,
              currencyCode: teacher.currencyCode!,
            })
            .returning();
          if (!lessonPackage) {
            throw new ApiError(500, "INTERNAL", "Could not save lesson package");
          }
          packageId = lessonPackage.id;
        }
        const saved = [];
        for (const [index, start] of starts.entries()) {
          const end = new Date(start.getTime() + duration * 60_000);
          await assertSlotOpen(teacher.userId, input.studentUserId, start, end);
          const [row] = await tx
            .insert(bookings)
            .values({
              teacherUserId: teacher.userId,
              studentUserId: input.studentUserId,
              bookedByUserId: actor.userId,
              subjectSlug: input.subjectSlug,
              kind: input.kind,
              status: "confirmed",
              startsAt: start,
              endsAt: end,
              durationMinutes: duration,
              timezone: viewerZone,
              seriesId,
              seriesIndex: weeks > 1 ? index + 1 : null,
              seriesTotal: weeks > 1 ? weeks : null,
              packageId,
              amountMinor,
              currencyCode: teacher.currencyCode!,
            })
            .returning();
          if (!row) {
            throw new ApiError(500, "INTERNAL", "Could not save the booking");
          }
          await tx.insert(bookingEvents).values({
            bookingId: row.id,
            kind: "created",
            actorUserId: actor.userId,
            actorRole: actor.roleKey,
            toStartsAt: start,
          });
          saved.push(row);
        }
          return saved;
        }),
      );
    });

    const [student] = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, input.studentUserId))
      .limit(1);

    const hydrated = await hydrateBookings(created, viewerZone);
    const first = hydrated[0];
    const whenLines = hydrated
      .map((row) =>
        row.seriesTotal
          ? `${row.whenLabel} (${row.seriesIndex}/${row.seriesTotal})`
          : row.whenLabel,
      )
      .join("\n");
    const subjectName = first?.subjectName ?? input.subjectSlug;
    const kindLabel = first?.kindLabel ?? "One-to-one lesson";
    const durationLabel = `${first?.durationMinutes ?? duration} minutes`;
    const familyLine = [
      `${student?.displayName ?? "A student"} booked a ${kindLabel.toLowerCase()} with ${teacher.displayName}.`,
      `Subject: ${subjectName}`,
      `Booking: ${first?.bookingModeLabel ?? "Single booking"}`,
      `Length: ${durationLabel}`,
      whenLines,
      first?.amountFormatted ? `Price: ${first.amountFormatted}` : "",
      first?.packageTotalFormatted
        ? `Package total: ${first.packageTotalFormatted}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const teacherLine = [
      `${student?.displayName ?? "A student"} booked a ${kindLabel.toLowerCase()} with you.`,
      `Subject: ${subjectName}`,
      `Booking: ${first?.bookingModeLabel ?? "Single booking"}`,
      `Length: ${durationLabel}`,
      whenLines,
    ].join("\n");

    const [booker] = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);

    await sendAccountEmail({
      to: teacher.email,
      subject: `New one-to-one ${input.kind === "trial" ? "trial " : ""}lesson`,
      text: teacherLine,
    });
    if (booker?.email && booker.email !== teacher.email) {
      await sendAccountEmail({
        to: booker.email,
        subject: `Your ${kindLabel.toLowerCase()} is booked`,
        text: familyLine,
      });
    }
    await writeAuditLog({
      actor,
      action: "bookings.created",
      entityType: "booking",
      entityId: created[0]?.id,
      ipAddress: ip,
      metadata: {
        teacherUserId: teacher.userId,
        studentUserId: input.studentUserId,
        weeks,
        bookingMode,
        packageSize: bookingMode === "package" ? weeks : undefined,
        packageDiscountPercent: packageOption?.discountPercent,
        kind: input.kind,
        format: LESSON_FORMAT_ONE_TO_ONE,
        durationMinutes: duration,
        trialPricePercent:
          input.kind === "trial" ? policy.trialPricePercent : undefined,
      },
    });

    return {
      timeZone: viewerZone,
      timezones: timezoneOptions(viewerZone),
      bookings: hydrated,
      changeRecords: { teacher: [], student: [] },
    };
  } catch (error) {
    if (isLockError(error)) {
      throw new ApiError(409, "SLOT_TAKEN", "That time is being booked. Try again.");
    }
    throw error;
  }
}

async function loadBooking(id: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Booking not found");
  }
  return row;
}

function canManage(actor: ApiActor, row: typeof bookings.$inferSelect) {
  if (isStaffRole(actor.roleKey) && hasAnyPermission(actor, ["classes.manage", "teachers.approve"])) {
    return true;
  }
  if (actor.roleKey === "teacher") {
    return actor.userId === row.teacherUserId;
  }
  if (actor.roleKey === "student") {
    return actor.userId === row.studentUserId;
  }
  return actor.userId === row.bookedByUserId;
}

async function syncBookingPackageStatus(packageId?: string | null) {
  if (!packageId) return;
  const rows = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.packageId, packageId));
  const status = rows.some((row) => row.status === "confirmed")
    ? "active"
    : rows.some(
          (row) => row.status === "completed" || row.status === "no_show",
        )
      ? "completed"
      : "cancelled";
  await db
    .update(bookingPackages)
    .set({ status })
    .where(eq(bookingPackages.id, packageId));
}

function cancelOutcomeFor(
  actor: ApiActor,
  row: typeof bookings.$inferSelect,
  cancelNoticeMinutes: number,
): CancelOutcome {
  if (
    row.amountMinor === 0 ||
    isStaffRole(actor.roleKey) ||
    actor.roleKey === "teacher"
  ) {
    return "no_charge";
  }
  const until = row.startsAt.getTime() - Date.now();
  if (until >= cancelNoticeMinutes * 60_000) {
    return "credit_pending";
  }
  return "forfeit";
}

type CancellationFinancialAction = "none" | "credit" | "refund" | "forfeit";

function cancellationFinancialActionFor(
  actor: ApiActor,
  row: typeof bookings.$inferSelect,
  outcome: CancelOutcome,
): CancellationFinancialAction {
  if (row.amountMinor === 0) return "none";
  if (isStaffRole(actor.roleKey) || actor.roleKey === "teacher") return "refund";
  return outcome === "credit_pending" ? "credit" : "forfeit";
}

function assertCancellationAllowed(
  actor: ApiActor,
  row: typeof bookings.$inferSelect,
  reason?: string,
) {
  if (row.status !== "confirmed") {
    throw new ApiError(400, "LOCKED", "Only a confirmed lesson can be cancelled");
  }
  if (row.startsAt.getTime() <= Date.now()) {
    throw new ApiError(400, "LOCKED", "A lesson cannot be cancelled after it starts");
  }
  if (
    (isStaffRole(actor.roleKey) || actor.roleKey === "teacher") &&
    !reason?.trim()
  ) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Teachers and staff must provide a cancellation reason",
    );
  }
}

export async function cancelBooking(
  actor: ApiActor,
  id: string,
  input: CancelBookingInput,
  ip: string,
) {
  const row = await loadBooking(id);
  if (!canManage(actor, row)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change this booking");
  }
  const reason = input.reason?.trim() || null;
  assertCancellationAllowed(actor, row, reason ?? undefined);
  const policy = await getBookingPolicy();
  let outcome = cancelOutcomeFor(actor, row, policy.cancelNoticeMinutes);
  let financialAction = cancellationFinancialActionFor(actor, row, outcome);
  try {
    await withLock(`booking:${row.teacherUserId}`, 8_000, async () => {
      await withLock(`booking:student:${row.studentUserId}`, 8_000, async () => {
        await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(bookings)
            .where(eq(bookings.id, id))
            .limit(1);
          if (!current) {
            throw new ApiError(404, "NOT_FOUND", "Booking not found");
          }
          assertCancellationAllowed(actor, current, reason ?? undefined);
          const currentOutcome = cancelOutcomeFor(
            actor,
            current,
            policy.cancelNoticeMinutes,
          );
          outcome = currentOutcome;
          financialAction = cancellationFinancialActionFor(
            actor,
            current,
            currentOutcome,
          );
          let financeOperationId: string | null = null;
          if (financialAction === "credit" || financialAction === "refund") {
            const [operation] = await tx
              .insert(financeOperations)
              .values({
                kind: financialAction,
                status: "in_review",
                amountMinor: current.amountMinor,
                currencyCode: current.currencyCode,
                counterpartyUserId: current.bookedByUserId,
                reference: `booking:${current.id}:cancellation`,
                notes:
                  reason ??
                  `Automatic ${financialAction} review after cancellation`,
                createdByUserId: actor.userId,
              })
              .returning({ id: financeOperations.id });
            if (!operation) {
              throw new ApiError(
                500,
                "INTERNAL",
                "Could not record the cancellation consequence",
              );
            }
            financeOperationId = operation.id;
          }
          await tx
            .update(bookings)
            .set({
              status: "cancelled",
              cancelOutcome: currentOutcome,
              cancelledAt: new Date(),
              cancelledByUserId: actor.userId,
              cancelReason: reason,
              cancelFinancialAction: financialAction,
              cancelFinanceOperationId: financeOperationId,
            })
            .where(
              and(eq(bookings.id, id), eq(bookings.status, "confirmed")),
            );
          await tx.insert(bookingEvents).values({
            bookingId: id,
            kind: "cancelled",
            actorUserId: actor.userId,
            actorRole: actor.roleKey,
            note: reason,
            fromStartsAt: current.startsAt,
            outcome: currentOutcome,
          });
        });
      });
    });
  } catch (error) {
    if (isLockError(error)) {
      throw new ApiError(
        409,
        "LOCKED",
        "This lesson is being changed. Try again.",
      );
    }
    throw error;
  }
  await writeAuditLog({
    actor,
    action: "bookings.cancelled",
    entityType: "booking",
    entityId: id,
    ipAddress: ip,
    metadata: { outcome, financialAction, reasonProvided: Boolean(reason) },
  });
  await syncBookingPackageStatus(row.packageId);
  return listActorBookings(actor);
}

export async function cancelBookingSeries(
  actor: ApiActor,
  id: string,
  input: CancelBookingInput,
  ip: string,
) {
  const selected = await loadBooking(id);
  if (!canManage(actor, selected)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change this booking series");
  }
  if (!selected.seriesId) {
    throw new ApiError(400, "VALIDATION", "This is a single booking");
  }
  const reason = input.reason?.trim() || null;
  assertCancellationAllowed(actor, selected, reason ?? undefined);
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.seriesId, selected.seriesId),
        eq(bookings.status, "confirmed"),
        gte(bookings.startsAt, selected.startsAt),
      ),
    )
    .orderBy(asc(bookings.startsAt));
  if (!rows.length) {
    throw new ApiError(400, "LOCKED", "No remaining confirmed lessons to cancel");
  }
  const policy = await getBookingPolicy();
  const outcomes: CancelOutcome[] = [];
  const financialActions: CancellationFinancialAction[] = [];
  try {
    await withLock(`booking:${selected.teacherUserId}`, 8_000, async () => {
      await withLock(
        `booking:student:${selected.studentUserId}`,
        8_000,
        async () => {
          await db.transaction(async (tx) => {
            const currentRows = await tx
              .select()
              .from(bookings)
              .where(
                and(
                  inArray(
                    bookings.id,
                    rows.map((row) => row.id),
                  ),
                  eq(bookings.status, "confirmed"),
                ),
              );
            if (currentRows.length !== rows.length) {
              throw new ApiError(
                409,
                "LOCKED",
                "One or more lessons changed while cancelling",
              );
            }
            for (const row of currentRows) {
              assertCancellationAllowed(actor, row, reason ?? undefined);
              const outcome = cancelOutcomeFor(
                actor,
                row,
                policy.cancelNoticeMinutes,
              );
              outcomes.push(outcome);
              const financialAction = cancellationFinancialActionFor(
                actor,
                row,
                outcome,
              );
              financialActions.push(financialAction);
              let financeOperationId: string | null = null;
              if (financialAction === "credit" || financialAction === "refund") {
                const [operation] = await tx
                  .insert(financeOperations)
                  .values({
                    kind: financialAction,
                    status: "in_review",
                    amountMinor: row.amountMinor,
                    currencyCode: row.currencyCode,
                    counterpartyUserId: row.bookedByUserId,
                    reference: `booking:${row.id}:cancellation`,
                    notes:
                      reason ??
                      `Automatic ${financialAction} review after series cancellation`,
                    createdByUserId: actor.userId,
                  })
                  .returning({ id: financeOperations.id });
                if (!operation) {
                  throw new ApiError(
                    500,
                    "INTERNAL",
                    "Could not record the cancellation consequence",
                  );
                }
                financeOperationId = operation.id;
              }
              await tx
                .update(bookings)
                .set({
                  status: "cancelled",
                  cancelOutcome: outcome,
                  cancelledAt: new Date(),
                  cancelledByUserId: actor.userId,
                  cancelReason: reason,
                  cancelFinancialAction: financialAction,
                  cancelFinanceOperationId: financeOperationId,
                })
                .where(
                  and(
                    eq(bookings.id, row.id),
                    eq(bookings.status, "confirmed"),
                  ),
                );
              await tx.insert(bookingEvents).values({
                bookingId: row.id,
                kind: "cancelled",
                actorUserId: actor.userId,
                actorRole: actor.roleKey,
                note: reason,
                fromStartsAt: row.startsAt,
                outcome,
              });
            }
          });
        },
      );
    });
  } catch (error) {
    if (isLockError(error)) {
      throw new ApiError(
        409,
        "LOCKED",
        "This booking series is being changed. Try again.",
      );
    }
    throw error;
  }
  await writeAuditLog({
    actor,
    action: "bookings.series_cancelled",
    entityType: "booking_series",
    entityId: selected.seriesId,
    ipAddress: ip,
    metadata: {
      fromBookingId: id,
      cancelledCount: rows.length,
      noChargeCount: outcomes.filter((value) => value === "no_charge").length,
      creditPendingCount: outcomes.filter((value) => value === "credit_pending")
        .length,
      forfeitCount: outcomes.filter((value) => value === "forfeit").length,
      refundCount: financialActions.filter((value) => value === "refund").length,
      creditCount: financialActions.filter((value) => value === "credit").length,
      retainedPaymentCount: financialActions.filter(
        (value) => value === "forfeit",
      ).length,
      reasonProvided: Boolean(reason),
    },
  });
  await syncBookingPackageStatus(selected.packageId);
  return listActorBookings(actor);
}

async function assertRescheduleRestrictions(
  actor: ApiActor,
  row: typeof bookings.$inferSelect,
  nextStart: Date,
) {
  if (row.status !== "confirmed") {
    throw new ApiError(400, "LOCKED", "Only a confirmed lesson can be rescheduled");
  }
  const now = Date.now();
  if (row.startsAt.getTime() <= now) {
    throw new ApiError(400, "LOCKED", "A lesson cannot be moved after it starts");
  }
  if (nextStart.getTime() <= now) {
    throw new ApiError(422, "VALIDATION", "Choose a future start time");
  }
  if (nextStart.getTime() > now + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
    throw new ApiError(
      422,
      "VALIDATION",
      `Choose a time within the next ${BOOKING_HORIZON_DAYS} days`,
    );
  }
  if (nextStart.getTime() === row.startsAt.getTime()) {
    throw new ApiError(422, "VALIDATION", "Choose a different start time");
  }

  const notice = await resolveTeacherMinNotice(row.teacherUserId);
  const bypassNotice = isStaffRole(actor.roleKey) || actor.roleKey === "teacher";
  if (
    !bypassNotice &&
    row.startsAt.getTime() - now < notice.policy.cancelNoticeMinutes * 60_000
  ) {
    throw new ApiError(
      400,
      "LOCKED",
      "This lesson is inside the reschedule notice window",
    );
  }
  if (!bypassNotice) {
    assertBookingMinNotice(nextStart, notice.effectiveMinutes);
  }
  return { notice, bypassNotice };
}

export async function rescheduleBooking(
  actor: ApiActor,
  id: string,
  input: RescheduleBookingInput,
  ip: string,
) {
  const row = await loadBooking(id);
  if (!canManage(actor, row)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change this booking");
  }
  const nextStart = new Date(input.startsAt);
  if (Number.isNaN(nextStart.getTime())) {
    throw new ApiError(422, "VALIDATION", "Choose a valid start time");
  }
  const { bypassNotice } = await assertRescheduleRestrictions(
    actor,
    row,
    nextStart,
  );
  if (
    input.durationMinutes != null &&
    input.durationMinutes !== row.durationMinutes
  ) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Lesson length cannot change during rescheduling",
    );
  }
  const duration = row.durationMinutes;
  const nextEnd = new Date(nextStart.getTime() + duration * 60_000);
  const available = await listTeacherSlots(row.teacherUserId, {
    durationMinutes: duration,
    viewerUserId: actor.userId,
    ignoreMinNotice: bypassNotice,
    ignoreBookingIds: [row.id],
  });
  if (
    !available.slots.some(
      (slot) => new Date(slot.startsAt).getTime() === nextStart.getTime(),
    )
  ) {
    throw new ApiError(409, "SLOT_TAKEN", "That time is no longer available");
  }

  try {
    await withLock(`booking:${row.teacherUserId}`, 8_000, async () => {
      await withLock(`booking:student:${row.studentUserId}`, 8_000, async () => {
        await assertSlotOpen(
          row.teacherUserId,
          row.studentUserId,
          nextStart,
          nextEnd,
          [row.id],
        );
        await db.transaction(async (tx) => {
          const [current] = await tx
            .select({ status: bookings.status, startsAt: bookings.startsAt })
            .from(bookings)
            .where(eq(bookings.id, id))
            .limit(1);
          if (
            current?.status !== "confirmed" ||
            current.startsAt.getTime() !== row.startsAt.getTime()
          ) {
            throw new ApiError(
              409,
              "LOCKED",
              "This lesson changed while rescheduling",
            );
          }
          await tx
            .update(bookings)
            .set({
              startsAt: nextStart,
              endsAt: nextEnd,
              durationMinutes: duration,
            })
            .where(eq(bookings.id, id));
          await tx.insert(bookingEvents).values({
            bookingId: id,
            kind: "rescheduled",
            actorUserId: actor.userId,
            actorRole: actor.roleKey,
            note: input.reason?.trim() || null,
            fromStartsAt: row.startsAt,
            toStartsAt: nextStart,
          });
        });
      });
    });
  } catch (error) {
    if (isLockError(error)) {
      throw new ApiError(409, "SLOT_TAKEN", "That time is being booked. Try again.");
    }
    throw error;
  }

  await writeAuditLog({
    actor,
    action: "bookings.rescheduled",
    entityType: "booking",
    entityId: id,
    ipAddress: ip,
  });
  return listActorBookings(actor);
}

export async function rescheduleBookingSeries(
  actor: ApiActor,
  id: string,
  input: RescheduleBookingInput,
  ip: string,
) {
  const selected = await loadBooking(id);
  if (!canManage(actor, selected)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change this booking series");
  }
  if (!selected.seriesId) {
    throw new ApiError(400, "VALIDATION", "This is a single booking");
  }
  const nextStart = new Date(input.startsAt);
  if (Number.isNaN(nextStart.getTime())) {
    throw new ApiError(422, "VALIDATION", "Choose a valid start time");
  }
  const { bypassNotice } = await assertRescheduleRestrictions(
    actor,
    selected,
    nextStart,
  );
  if (
    input.durationMinutes != null &&
    input.durationMinutes !== selected.durationMinutes
  ) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Lesson length cannot change during rescheduling",
    );
  }

  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.seriesId, selected.seriesId),
        eq(bookings.status, "confirmed"),
        gte(bookings.startsAt, selected.startsAt),
      ),
    )
    .orderBy(asc(bookings.startsAt));
  if (!rows.some((row) => row.id === selected.id)) {
    throw new ApiError(400, "LOCKED", "This lesson is no longer confirmed");
  }

  const shiftMs = nextStart.getTime() - selected.startsAt.getTime();
  const targets = rows.map((row) => {
    const startsAt = new Date(row.startsAt.getTime() + shiftMs);
    return {
      row,
      startsAt,
      endsAt: new Date(startsAt.getTime() + row.durationMinutes * 60_000),
    };
  });
  const teacherZone = await resolveScheduleTimeZone(selected.teacherUserId);
  const lastTarget = targets[targets.length - 1]!;
  const available = await listTeacherSlots(selected.teacherUserId, {
    from: zonedYmd(nextStart, teacherZone).iso,
    to: zonedYmd(lastTarget.startsAt, teacherZone).iso,
    durationMinutes: selected.durationMinutes,
    timeZone: teacherZone,
    viewerUserId: actor.userId,
    ignoreMinNotice: bypassNotice,
    ignoreBookingIds: rows.map((row) => row.id),
  });
  const openStarts = new Set(
    available.slots.map((slot) => new Date(slot.startsAt).getTime()),
  );
  if (targets.some((target) => !openStarts.has(target.startsAt.getTime()))) {
    throw new ApiError(
      409,
      "SLOT_TAKEN",
      "One or more shifted lessons are outside availability or no longer open",
    );
  }

  const reason = input.reason?.trim() || null;
  const ignoredIds = rows.map((row) => row.id);
  try {
    await withLock(`booking:${selected.teacherUserId}`, 8_000, async () => {
      await withLock(
        `booking:student:${selected.studentUserId}`,
        8_000,
        async () => {
          for (const target of targets) {
            await assertSlotOpen(
              selected.teacherUserId,
              selected.studentUserId,
              target.startsAt,
              target.endsAt,
              ignoredIds,
            );
          }
          await db.transaction(async (tx) => {
            const stillConfirmed = await tx
              .select({ id: bookings.id })
              .from(bookings)
              .where(
                and(
                  inArray(bookings.id, ignoredIds),
                  eq(bookings.status, "confirmed"),
                ),
              );
            if (stillConfirmed.length !== ignoredIds.length) {
              throw new ApiError(
                409,
                "LOCKED",
                "One or more lessons changed while rescheduling",
              );
            }
            const orderedTargets =
              shiftMs > 0 ? [...targets].reverse() : targets;
            for (const target of orderedTargets) {
              await tx
                .update(bookings)
                .set({
                  startsAt: target.startsAt,
                  endsAt: target.endsAt,
                })
                .where(
                  and(
                    eq(bookings.id, target.row.id),
                    eq(bookings.status, "confirmed"),
                  ),
                );
              await tx.insert(bookingEvents).values({
                bookingId: target.row.id,
                kind: "rescheduled",
                actorUserId: actor.userId,
                actorRole: actor.roleKey,
                note: reason,
                fromStartsAt: target.row.startsAt,
                toStartsAt: target.startsAt,
              });
            }
          });
        },
      );
    });
  } catch (error) {
    if (isLockError(error)) {
      throw new ApiError(
        409,
        "SLOT_TAKEN",
        "This series is being changed. Try again.",
      );
    }
    throw error;
  }

  await writeAuditLog({
    actor,
    action: "bookings.series_rescheduled",
    entityType: "booking_series",
    entityId: selected.seriesId,
    ipAddress: ip,
    metadata: {
      fromBookingId: selected.id,
      movedCount: targets.length,
      fromStartsAt: selected.startsAt.toISOString(),
      toStartsAt: nextStart.toISOString(),
    },
  });
  return listActorBookings(actor);
}

export async function completeBooking(
  actor: ApiActor,
  id: string,
  status: "completed" | "no_show",
  notes: string | undefined,
  ip: string,
) {
  const row = await loadBooking(id);
  if (!canManage(actor, row) || (!isStaffRole(actor.roleKey) && actor.roleKey !== "teacher")) {
    throw new ApiError(403, "FORBIDDEN", "Only the teacher or staff can complete a lesson");
  }
  if (row.status !== "confirmed") {
    throw new ApiError(400, "LOCKED", "Only a confirmed lesson can be completed");
  }
  if (row.endsAt.getTime() > Date.now()) {
    throw new ApiError(400, "LOCKED", "Wait until the lesson end time to record attendance");
  }

  const [subject] = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(eq(subjects.slug, row.subjectSlug))
    .limit(1);

  const historyStatus = status === "no_show" ? "no_show" : "completed";
  const attendedMinutes = await attendedMinutesForRecord({
    studentUserId: row.studentUserId,
    bookingId: row.id,
    scheduledMinutes: row.durationMinutes,
    status: historyStatus,
  });
  const [history] = await db
    .insert(lessonHistory)
    .values({
      studentUserId: row.studentUserId,
      teacherUserId: row.teacherUserId,
      subjectSlug: row.subjectSlug,
      title:
        row.kind === "trial"
          ? `Trial · ${defaultLessonTitle(subject?.name)}`
          : defaultLessonTitle(subject?.name),
      status: historyStatus,
      startedAt: row.startsAt,
      durationMinutes: row.durationMinutes,
      attendedMinutes,
      notes: notes?.trim() || null,
      recordedByUserId: actor.userId,
    })
    .returning();

  await db
    .update(bookings)
    .set({
      status,
      lessonHistoryId: history?.id ?? null,
    })
    .where(eq(bookings.id, id));
  await db.insert(bookingEvents).values({
    bookingId: id,
    kind: status,
    actorUserId: actor.userId,
    actorRole: actor.roleKey,
    note: notes?.trim() || null,
  });
  await writeAuditLog({
    actor,
    action: `bookings.${status}`,
    entityType: "booking",
    entityId: id,
    ipAddress: ip,
  });
  await syncBookingPackageStatus(row.packageId);
  return listActorBookings(actor);
}

export async function bookingWorkspace(actor: ApiActor) {
  const [calendar, policy] = await Promise.all([
    listActorBookings(actor),
    getBookingPolicy(),
  ]);
  return {
    ...calendar,
    policy: {
      minNoticeMinutes: policy.minNoticeMinutes,
      cancelNoticeMinutes: policy.cancelNoticeMinutes,
      minCommitmentLessons: policy.minCommitmentLessons,
      lessonDurationMinutes: policy.lessonDurationMinutes,
      durationOptions: lessonDurationOptions(policy.lessonDurationMinutes),
      trialDurationMinutes: policy.trialDurationMinutes,
      trialPricePercent: policy.trialPricePercent,
    },
  };
}

export async function bookingViewerForTeacherPage(viewer: {
  id: string;
  roleKey: string;
} | null) {
  if (!viewer) {
    return null;
  }
  if (viewer.roleKey === "parent") {
    const children = await listParentChildren(viewer.id);
    return {
      roleKey: viewer.roleKey,
      userId: viewer.id,
      children: children.map((child) => ({
        userId: child.userId,
        displayName: child.displayName,
      })),
      parentManaged: false,
    };
  }
  if (viewer.roleKey === "student") {
    const [row] = await db
      .select({ parentManaged: studentProfiles.parentManaged })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, viewer.id))
      .limit(1);
    return {
      roleKey: viewer.roleKey,
      userId: viewer.id,
      children: [],
      parentManaged: Boolean(row?.parentManaged),
    };
  }
  return {
    roleKey: viewer.roleKey,
    userId: viewer.id,
    children: [],
    parentManaged: false,
  };
}
