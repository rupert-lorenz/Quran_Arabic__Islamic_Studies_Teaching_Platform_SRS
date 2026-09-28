import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  currencies,
  groupClassApplications,
  groupClassOpportunities,
  groupLessons,
  subjects,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import {
  formatWeekdayList,
  MAX_GROUP_CLASS_DAYS,
  MAX_GROUP_CLASS_SESSIONS,
  rangesOverlap,
  resolveGroupMinStudents,
  sortedWeekdays,
} from "@/lib/booking";
import { presentStudentAmount } from "@/lib/currency";
import { normalizeTimezone } from "@/lib/geo";
import { formatMoneyMinor } from "@/lib/teacher-rate-display";
import {
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
import { getRequestMoney } from "@/server/money/currency";
import {
  resolveDisplayTimeZone,
  resolveScheduleTimeZone,
} from "./policy";
import type {
  ApplyGroupClassOpportunityInput,
  CreateGroupClassOpportunityInput,
  SelectGroupClassTeacherInput,
} from "./schemas";

export type GroupOpportunityApplicationView = {
  id: string;
  teacherUserId: string;
  teacherName: string;
  bidMinor: number;
  bidFormatted: string;
  message: string | null;
  status: string;
  createdAt: string;
};

export type GroupOpportunityView = {
  id: string;
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
  scheduleLabel: string | null;
  durationMinutes: number;
  timezone: string;
  capacity: number;
  minStudents: number;
  sessionCount: number;
  studentPriceFormatted: string;
  seriesTotalFormatted: string;
  listedPriceFormatted: string | null;
  teacherPaymentFormatted: string;
  teacherPaymentSeriesFormatted: string;
  applicationDeadline: string | null;
  applicationDeadlineLabel: string | null;
  visibleFromLabel: string | null;
  isVisible: boolean;
  isOpenForApplication: boolean;
  applicationCount: number;
  myApplication: {
    id: string;
    status: string;
    bidFormatted: string;
    message: string | null;
  } | null;
  canApply: boolean;
  cannotApplyReason: string | null;
  selectedApplicationId: string | null;
  selectedTeacherName: string | null;
  selectedGroupLessonId: string | null;
  applications?: GroupOpportunityApplicationView[];
};

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

function generateOpportunityStarts(input: {
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
    if (!days.some((value) => value === weekday)) continue;
    if (
      Math.floor(isoDateDiffDays(input.startsOn, isoDate) / 7) %
        input.weekInterval !==
      0
    ) {
      continue;
    }
    starts.push(
      zonedLocalToUtc(input.timeZone, year, month, day, clock.hour, clock.minute),
    );
  }
  return starts;
}

function opportunityStarts(row: typeof groupClassOpportunities.$inferSelect) {
  const startsOn = availabilityDate(row.startsOn) ?? zonedYmd(row.startsAt, row.timezone).iso;
  const endsOn = availabilityDate(row.endsOn) ?? startsOn;
  const weekdays = parseWeekdays(row.weekdays);
  const generated = generateOpportunityStarts({
    templateStart: row.startsAt,
    timeZone: row.timezone,
    startsOn,
    endsOn,
    weekdays: weekdays.length ? weekdays : [zonedWeekday(row.startsAt, row.timezone)],
    weekInterval: row.weekInterval || 1,
  });
  return generated.length ? generated : [row.startsAt];
}

function isOpportunityOpen(row: typeof groupClassOpportunities.$inferSelect, now = Date.now()) {
  return (
    row.status === "open" &&
    row.startsAt.getTime() > now &&
    (!row.visibleFrom || row.visibleFrom.getTime() <= now) &&
    (!row.applicationDeadline || row.applicationDeadline.getTime() >= now)
  );
}

function parseStartTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new ApiError(422, "VALIDATION", "Choose a valid class time");
  }
  return { hour, minute };
}

function requireClassManager(actor: ApiActor) {
  if (!isStaffRole(actor.roleKey) || !hasAnyPermission(actor, "classes.manage")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage group-class opportunities");
  }
}

async function assertTeacherCanTakeOpportunity(
  teacherUserId: string,
  row: typeof groupClassOpportunities.$inferSelect,
) {
  await requireApprovedGroupTeacher(teacherUserId);
  const [offered] = await db
    .select({ slug: teacherSubjects.subjectSlug })
    .from(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.teacherUserId, teacherUserId),
        eq(teacherSubjects.subjectSlug, row.subjectSlug),
      ),
    )
    .limit(1);
  if (!offered) {
    throw new ApiError(422, "VALIDATION", "This teacher does not offer that subject");
  }
  const starts = opportunityStarts(row);
  const ends = starts.map(
    (start) => new Date(start.getTime() + row.durationMinutes * 60_000),
  );
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
  if (
    starts.some((start, index) =>
      occupied.some((busy) =>
        rangesOverlap(start, ends[index]!, busy.startsAt, busy.endsAt),
      ),
    )
  ) {
    throw new ApiError(409, "SLOT_TAKEN", "That time is no longer available");
  }
  return { starts, ends };
}

async function requireApprovedGroupTeacher(teacherUserId: string) {
  const [teacher] = await db
    .select({
      status: users.status,
      verificationStatus: teacherProfiles.verificationStatus,
      offersGroupTeaching: teacherProfiles.offersGroupTeaching,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(users.id, teacherProfiles.userId))
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (
    !teacher ||
    teacher.status !== "active" ||
    teacher.verificationStatus !== "approved"
  ) {
    throw new ApiError(403, "LOCKED", "Complete teacher approval first");
  }
  if (!teacher.offersGroupTeaching) {
    throw new ApiError(
      403,
      "LOCKED",
      "Enable group teaching before applying for a class opportunity",
    );
  }
  return teacher;
}

async function hydrateOpportunities(
  rows: (typeof groupClassOpportunities.$inferSelect)[],
  viewerTimeZone: string,
  options?: {
    teacherUserId?: string;
    revealApplications?: boolean;
    occupied?: { startsAt: Date; endsAt: Date }[];
  },
): Promise<GroupOpportunityView[]> {
  if (!rows.length) return [];
  const money = await getRequestMoney();
  const subjectSlugs = [...new Set(rows.map((row) => row.subjectSlug))];
  const currencyCodes = [...new Set(rows.map((row) => row.currencyCode))];
  const opportunityIds = rows.map((row) => row.id);
  const [subjectRows, currencyRows, applicationRows] = await Promise.all([
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
        id: groupClassApplications.id,
        opportunityId: groupClassApplications.opportunityId,
        teacherUserId: groupClassApplications.teacherUserId,
        teacherName: users.displayName,
        bidMinor: groupClassApplications.bidMinor,
        message: groupClassApplications.message,
        status: groupClassApplications.status,
        createdAt: groupClassApplications.createdAt,
      })
      .from(groupClassApplications)
      .innerJoin(users, eq(users.id, groupClassApplications.teacherUserId))
      .where(inArray(groupClassApplications.opportunityId, opportunityIds)),
  ]);
  const subjectNames = new Map(subjectRows.map((row) => [row.slug, row.name]));
  const currencyMap = new Map(currencyRows.map((row) => [row.code, row]));

  return rows.map((row) => {
    const starts = opportunityStarts(row);
    const currency = currencyMap.get(row.currencyCode);
    const converted = convertedTimeLabels(row.startsAt, viewerTimeZone, row.timezone);
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
      sessionCount: starts.length,
    });
    const payment = presentStudentAmount({
      amountMinor: row.teacherPaymentMinor,
      listing: currency
        ? {
            code: currency.code,
            symbol: currency.symbol,
            decimalPlaces: currency.decimalPlaces,
          }
        : null,
      display: money.currency,
      convert: money.convert,
      sessionCount: starts.length,
    });
    const apps = applicationRows.filter((item) => item.opportunityId === row.id);
    const mine = options?.teacherUserId
      ? apps.find((item) => item.teacherUserId === options.teacherUserId)
      : null;
    const open = isOpportunityOpen(row);
    const ends = starts.map(
      (start) => new Date(start.getTime() + row.durationMinutes * 60_000),
    );
    const hasConflict = Boolean(
      options?.occupied?.some((busy) =>
        starts.some((start, index) =>
          rangesOverlap(start, ends[index]!, busy.startsAt, busy.endsAt),
        ),
      ),
    );
    const selected = apps.find((item) => item.status === "accepted")
      ?? apps.find((item) => item.id === row.selectedApplicationId);
    let cannotApplyReason: string | null = null;
    if (mine?.status === "accepted") {
      cannotApplyReason = "You were selected to teach this class";
    } else if (mine?.status === "rejected") {
      cannotApplyReason = "Another teacher was selected";
    } else if (mine?.status === "pending") {
      cannotApplyReason = "You have already applied";
    } else if (!open) {
      cannotApplyReason = "Applications are closed";
    } else if (hasConflict) {
      cannotApplyReason = "This schedule conflicts with a class you already have";
    }
    return {
      id: row.id,
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
      scheduleLabel: scheduleLabelFor(
        availabilityDate(row.startsOn),
        availabilityDate(row.endsOn),
        parseWeekdays(row.weekdays),
        row.weekInterval || 1,
      ),
      durationMinutes: row.durationMinutes,
      timezone: viewerTimeZone,
      capacity: row.capacity,
      minStudents: row.minStudents,
      sessionCount: starts.length,
      studentPriceFormatted: price.studentPriceFormatted,
      seriesTotalFormatted: price.seriesTotalFormatted,
      listedPriceFormatted: price.listedPriceFormatted,
      teacherPaymentFormatted: payment.studentPriceFormatted,
      teacherPaymentSeriesFormatted: payment.seriesTotalFormatted,
      applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
      applicationDeadlineLabel: row.applicationDeadline
        ? formatInTimeZone(row.applicationDeadline, viewerTimeZone)
        : null,
      visibleFromLabel: row.visibleFrom
        ? formatInTimeZone(row.visibleFrom, viewerTimeZone)
        : null,
      isVisible: !row.visibleFrom || row.visibleFrom.getTime() <= Date.now(),
      isOpenForApplication: open,
      applicationCount: apps.filter((item) => item.status === "pending").length,
      myApplication: mine
        ? {
            id: mine.id,
            status: mine.status,
            bidFormatted: currency
              ? formatMoneyMinor(
                  mine.bidMinor,
                  currency.decimalPlaces,
                  currency.symbol,
                )
              : `${mine.bidMinor}`,
            message: mine.message,
          }
        : null,
      canApply:
        open &&
        !hasConflict &&
        (!mine || mine.status === "withdrawn"),
      cannotApplyReason,
      selectedApplicationId: row.selectedApplicationId ?? selected?.id ?? null,
      selectedTeacherName: selected?.teacherName ?? null,
      selectedGroupLessonId: row.selectedGroupLessonId ?? null,
      ...(options?.revealApplications
        ? {
            applications: apps
              .filter((item) => item.status !== "withdrawn")
              .sort((left, right) => left.bidMinor - right.bidMinor)
              .map((item) => ({
                id: item.id,
                teacherUserId: item.teacherUserId,
                teacherName: item.teacherName,
                bidMinor: item.bidMinor,
                bidFormatted: currency
                  ? formatMoneyMinor(
                      item.bidMinor,
                      currency.decimalPlaces,
                      currency.symbol,
                    )
                  : `${item.bidMinor}`,
                message: item.message,
                status: item.status,
                createdAt: item.createdAt.toISOString(),
              })),
          }
        : {}),
    };
  });
}

export async function listAdminGroupClassOpportunities(actor: ApiActor) {
  requireClassManager(actor);
  const timeZone = await resolveDisplayTimeZone(actor.userId);
  const rows = await db
    .select()
    .from(groupClassOpportunities)
    .orderBy(desc(groupClassOpportunities.createdAt))
    .limit(100);
  return hydrateOpportunities(rows, timeZone, { revealApplications: true });
}

export async function listTeacherGroupClassOpportunities(teacherUserId: string) {
  const [teacher] = await db
    .select({
      status: users.status,
      verificationStatus: teacherProfiles.verificationStatus,
      offersGroupTeaching: teacherProfiles.offersGroupTeaching,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(users.id, teacherProfiles.userId))
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (
    !teacher ||
    teacher.status !== "active" ||
    teacher.verificationStatus !== "approved"
  ) {
    throw new ApiError(403, "LOCKED", "Complete teacher approval first");
  }
  if (!teacher.offersGroupTeaching) {
    return [];
  }
  const timeZone = await resolveDisplayTimeZone(teacherUserId);
  const offered = await db
    .select({ slug: teacherSubjects.subjectSlug })
    .from(teacherSubjects)
    .where(eq(teacherSubjects.teacherUserId, teacherUserId));
  const slugs = offered.map((item) => item.slug);
  if (!slugs.length) return [];
  const now = new Date();
  const openRows = await db
    .select()
    .from(groupClassOpportunities)
    .where(
      and(
        eq(groupClassOpportunities.status, "open"),
        inArray(groupClassOpportunities.subjectSlug, slugs),
        gte(groupClassOpportunities.startsAt, now),
        or(
          isNull(groupClassOpportunities.visibleFrom),
          lte(groupClassOpportunities.visibleFrom, now),
        ),
      ),
    )
    .orderBy(asc(groupClassOpportunities.startsAt))
    .limit(100);
  const decidedRows = await db
    .select({ opportunity: groupClassOpportunities })
    .from(groupClassApplications)
    .innerJoin(
      groupClassOpportunities,
      eq(groupClassOpportunities.id, groupClassApplications.opportunityId),
    )
    .where(
      and(
        eq(groupClassApplications.teacherUserId, teacherUserId),
        inArray(groupClassApplications.status, ["accepted", "rejected", "pending"]),
      ),
    )
    .orderBy(desc(groupClassOpportunities.updatedAt))
    .limit(50);
  const visible = [
    ...new Map(
      [
        ...openRows.filter((row) => isOpportunityOpen(row)),
        ...decidedRows.map((item) => item.opportunity),
      ].map((row) => [row.id, row]),
    ).values(),
  ];
  const occupied = visible.length
    ? [
        ...(await db
          .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
          .from(bookings)
          .where(
            and(
              eq(bookings.teacherUserId, teacherUserId),
              inArray(bookings.status, ["confirmed", "completed"]),
            ),
          )),
        ...(await db
          .select({ startsAt: groupLessons.startsAt, endsAt: groupLessons.endsAt })
          .from(groupLessons)
          .where(
            and(
              eq(groupLessons.teacherUserId, teacherUserId),
              eq(groupLessons.status, "published"),
            ),
          )),
      ]
    : [];
  return hydrateOpportunities(visible, timeZone, {
    teacherUserId,
    occupied,
  });
}

export async function createGroupClassOpportunity(
  actor: ApiActor,
  input: CreateGroupClassOpportunityInput,
  ip: string,
) {
  requireClassManager(actor);
  const timeZone =
    normalizeTimezone(input.timeZone) ??
    (await resolveDisplayTimeZone(actor.userId));
  const [subject, currency] = await Promise.all([
    db
      .select({ slug: subjects.slug, isEnabled: subjects.isEnabled })
      .from(subjects)
      .where(eq(subjects.slug, input.subjectSlug))
      .limit(1),
    db
      .select({
        code: currencies.code,
        decimalPlaces: currencies.decimalPlaces,
        isEnabled: currencies.isEnabled,
      })
      .from(currencies)
      .where(eq(currencies.code, input.currencyCode.toUpperCase()))
      .limit(1),
  ]);
  if (!subject[0]?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "Choose an enabled subject");
  }
  if (!currency[0]?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "Choose an enabled currency");
  }
  if (isoDateDiffDays(input.startsOn, input.endsOn) > MAX_GROUP_CLASS_DAYS) {
    throw new ApiError(
      422,
      "VALIDATION",
      `Choose an end date within ${MAX_GROUP_CLASS_DAYS} days of the start date`,
    );
  }
  const clock = parseStartTime(input.startTime);
  const { year, month, day } = parseIsoDate(input.startsOn);
  const templateStart = zonedLocalToUtc(
    timeZone,
    year,
    month,
    day,
    clock.hour,
    clock.minute,
  );
  const weekdays = sortedWeekdays(
    input.weekdays?.length
      ? input.weekdays
      : [zonedWeekday(templateStart, timeZone)],
  );
  if (!weekdays.length) {
    throw new ApiError(422, "VALIDATION", "Choose at least one weekday");
  }
  const weekInterval = input.weekInterval ?? 1;
  const starts = generateOpportunityStarts({
    templateStart,
    timeZone,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    weekdays,
    weekInterval,
  });
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
    timeZone,
    { hour: 0, minute: 0 },
    "Choose a valid visibility date",
  );
  let applicationDeadline = parseScheduleInstant(
    input.applicationDeadline,
    timeZone,
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
    const deadlineDay = zonedYmd(applicationDeadline, timeZone).iso;
    const firstDay = zonedYmd(starts[0]!, timeZone).iso;
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
  const minStudents = resolveGroupMinStudents(
    input.minStudents,
    input.capacity,
  );
  const decimals = currency[0].decimalPlaces;
  const amountMinor = Math.round(input.studentPriceMajor * 10 ** decimals);
  const teacherPaymentMinor = Math.round(
    input.teacherPaymentMajor * 10 ** decimals,
  );
  const firstStart = starts[0]!;
  const firstEnd = new Date(firstStart.getTime() + input.durationMinutes * 60_000);
  const [row] = await db
    .insert(groupClassOpportunities)
    .values({
      subjectSlug: input.subjectSlug,
      title: input.title,
      description: input.description || null,
      level: input.level,
      minAge: input.minAge ?? null,
      maxAge: input.maxAge ?? null,
      startsAt: firstStart,
      endsAt: firstEnd,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      weekdays: serializeWeekdays(weekdays),
      weekInterval,
      durationMinutes: input.durationMinutes,
      timezone: timeZone,
      capacity: input.capacity,
      minStudents,
      amountMinor,
      teacherPaymentMinor,
      currencyCode: currency[0].code,
      visibleFrom,
      applicationDeadline,
      createdByUserId: actor.userId,
    })
    .returning();
  if (!row) {
    throw new ApiError(500, "INTERNAL", "Could not publish the class opportunity");
  }
  await writeAuditLog({
    actor,
    action: "group_class_opportunities.created",
    entityType: "group_class_opportunity",
    entityId: row.id,
    ipAddress: ip,
    metadata: {
      subjectSlug: input.subjectSlug,
      sessions: starts.length,
      teacherPaymentMinor,
      studentPriceMinor: amountMinor,
      currencyCode: currency[0].code,
      visibleFrom: visibleFrom?.toISOString() ?? null,
      applicationDeadline: applicationDeadline?.toISOString() ?? null,
    },
  });
  const [view] = await hydrateOpportunities([row], timeZone, {
    revealApplications: true,
  });
  return view;
}

export async function closeGroupClassOpportunity(
  actor: ApiActor,
  opportunityId: string,
  ip: string,
) {
  requireClassManager(actor);
  const [row] = await db
    .select()
    .from(groupClassOpportunities)
    .where(eq(groupClassOpportunities.id, opportunityId))
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Class opportunity not found");
  }
  if (row.status !== "open") {
    throw new ApiError(400, "LOCKED", "This opportunity is already closed");
  }
  const [updated] = await db
    .update(groupClassOpportunities)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedByUserId: actor.userId,
    })
    .where(eq(groupClassOpportunities.id, opportunityId))
    .returning();
  await writeAuditLog({
    actor,
    action: "group_class_opportunities.closed",
    entityType: "group_class_opportunity",
    entityId: opportunityId,
    ipAddress: ip,
  });
  const timeZone = await resolveDisplayTimeZone(actor.userId);
  const [view] = await hydrateOpportunities(updated ? [updated] : [row], timeZone, {
    revealApplications: true,
  });
  return view;
}

export async function selectGroupClassTeacher(
  actor: ApiActor,
  opportunityId: string,
  input: SelectGroupClassTeacherInput,
  ip: string,
) {
  requireClassManager(actor);
  return withLock(`group-opportunity:${opportunityId}`, 8_000, async () => {
    const [row] = await db
      .select()
      .from(groupClassOpportunities)
      .where(eq(groupClassOpportunities.id, opportunityId))
      .limit(1);
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "Class opportunity not found");
    }
    if (row.status === "filled") {
      throw new ApiError(400, "LOCKED", "A teacher has already been selected");
    }
    if (row.status === "cancelled") {
      throw new ApiError(400, "LOCKED", "This opportunity is cancelled");
    }
    if (row.startsAt.getTime() <= Date.now()) {
      throw new ApiError(400, "LOCKED", "The first class has already started");
    }
    const [application] = await db
      .select()
      .from(groupClassApplications)
      .where(
        and(
          eq(groupClassApplications.id, input.applicationId),
          eq(groupClassApplications.opportunityId, opportunityId),
        ),
      )
      .limit(1);
    if (!application || application.status !== "pending") {
      throw new ApiError(400, "LOCKED", "Choose a pending teacher application");
    }
    const { starts, ends } = await assertTeacherCanTakeOpportunity(
      application.teacherUserId,
      row,
    );
    const weekdays = parseWeekdays(row.weekdays);
    const startsOn = availabilityDate(row.startsOn) ?? zonedYmd(starts[0]!, row.timezone).iso;
    const endsOn =
      availabilityDate(row.endsOn) ??
      zonedYmd(starts[starts.length - 1]!, row.timezone).iso;
    const published = await withLock(
      `booking:${application.teacherUserId}`,
      8_000,
      async () =>
        db.transaction(async (tx) => {
          const seriesId = starts.length > 1 ? randomUUID() : null;
          const created = [];
          for (const [index, start] of starts.entries()) {
            const [lesson] = await tx
              .insert(groupLessons)
              .values({
                teacherUserId: application.teacherUserId,
                subjectSlug: row.subjectSlug,
                title: row.title,
                description: row.description,
                level: row.level,
                minAge: row.minAge,
                maxAge: row.maxAge,
                startsAt: start,
                endsAt: ends[index]!,
                startsOn,
                endsOn,
                weekdays: serializeWeekdays(weekdays),
                weekInterval: row.weekInterval || 1,
                durationMinutes: row.durationMinutes,
                timezone: row.timezone,
                capacity: row.capacity,
                minStudents: row.minStudents,
                amountMinor: row.amountMinor,
                teacherPaymentMinor: application.bidMinor,
                currencyCode: row.currencyCode,
                createdByUserId: actor.userId,
                seriesId,
                seriesIndex: starts.length > 1 ? index + 1 : null,
                seriesTotal: starts.length > 1 ? starts.length : null,
              })
              .returning();
            if (!lesson) {
              throw new ApiError(500, "INTERNAL", "Could not publish the selected class");
            }
            created.push(lesson);
          }
          await tx
            .update(groupClassApplications)
            .set({ status: "accepted" })
            .where(eq(groupClassApplications.id, application.id));
          await tx
            .update(groupClassApplications)
            .set({ status: "rejected" })
            .where(
              and(
                eq(groupClassApplications.opportunityId, opportunityId),
                ne(groupClassApplications.id, application.id),
                eq(groupClassApplications.status, "pending"),
              ),
            );
          const [updated] = await tx
            .update(groupClassOpportunities)
            .set({
              status: "filled",
              closedAt: row.closedAt ?? new Date(),
              closedByUserId: row.closedByUserId ?? actor.userId,
              selectedApplicationId: application.id,
              selectedGroupLessonId: created[0]!.id,
            })
            .where(eq(groupClassOpportunities.id, opportunityId))
            .returning();
          return { created, updated: updated ?? row };
        }),
    );
    await writeAuditLog({
      actor,
      action: "group_class_opportunities.teacher_selected",
      entityType: "group_class_opportunity",
      entityId: opportunityId,
      ipAddress: ip,
      metadata: {
        applicationId: application.id,
        teacherUserId: application.teacherUserId,
        bidMinor: application.bidMinor,
        groupLessonId: published.created[0]?.id ?? null,
        seriesId: published.created[0]?.seriesId ?? null,
        sessions: published.created.length,
      },
    });
    const timeZone = await resolveDisplayTimeZone(actor.userId);
    const [view] = await hydrateOpportunities([published.updated], timeZone, {
      revealApplications: true,
    });
    return view;
  });
}

export async function applyGroupClassOpportunity(
  actor: ApiActor,
  opportunityId: string,
  input: ApplyGroupClassOpportunityInput,
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can apply for class opportunities");
  }
  await requireApprovedGroupTeacher(actor.userId);
  return withLock(`group-opportunity:${opportunityId}`, 8_000, async () => {
    const [row] = await db
      .select()
      .from(groupClassOpportunities)
      .where(eq(groupClassOpportunities.id, opportunityId))
      .limit(1);
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "Class opportunity not found");
    }
    if (!isOpportunityOpen(row)) {
      throw new ApiError(400, "LOCKED", "This class opportunity is not open for applications");
    }
    await assertTeacherCanTakeOpportunity(actor.userId, row);
    const teacherTimeZone = await resolveScheduleTimeZone(actor.userId);
    const [currency] = await db
      .select({ decimalPlaces: currencies.decimalPlaces })
      .from(currencies)
      .where(eq(currencies.code, row.currencyCode))
      .limit(1);
    const decimals = currency?.decimalPlaces ?? 2;
    const bidMinor =
      input.bidMajor != null
        ? Math.round(input.bidMajor * 10 ** decimals)
        : row.teacherPaymentMinor;
    const [existing] = await db
      .select()
      .from(groupClassApplications)
      .where(
        and(
          eq(groupClassApplications.opportunityId, opportunityId),
          eq(groupClassApplications.teacherUserId, actor.userId),
        ),
      )
      .limit(1);
    if (existing?.status === "pending") {
      throw new ApiError(409, "CONFLICT", "You have already applied for this class");
    }
    if (existing?.status === "accepted" || existing?.status === "rejected") {
      throw new ApiError(400, "LOCKED", "This application can no longer be changed");
    }
    const saved = existing
      ? (
          await db
            .update(groupClassApplications)
            .set({
              bidMinor,
              message: input.message?.trim() || null,
              status: "pending",
            })
            .where(eq(groupClassApplications.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(groupClassApplications)
            .values({
              opportunityId,
              teacherUserId: actor.userId,
              bidMinor,
              message: input.message?.trim() || null,
            })
            .returning()
        )[0];
    if (!saved) {
      throw new ApiError(500, "INTERNAL", "Could not submit the application");
    }
    await writeAuditLog({
      actor,
      action: "group_class_opportunities.applied",
      entityType: "group_class_application",
      entityId: saved.id,
      ipAddress: ip,
      metadata: {
        opportunityId,
        bidMinor,
      },
    });
    const [view] = await hydrateOpportunities([row], teacherTimeZone, {
      teacherUserId: actor.userId,
    });
    return view;
  });
}

export async function withdrawGroupClassApplication(
  actor: ApiActor,
  opportunityId: string,
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can withdraw an application");
  }
  const [existing] = await db
    .select()
    .from(groupClassApplications)
    .where(
      and(
        eq(groupClassApplications.opportunityId, opportunityId),
        eq(groupClassApplications.teacherUserId, actor.userId),
      ),
    )
    .limit(1);
  if (!existing || existing.status !== "pending") {
    throw new ApiError(404, "NOT_FOUND", "No open application to withdraw");
  }
  await db
    .update(groupClassApplications)
    .set({ status: "withdrawn" })
    .where(eq(groupClassApplications.id, existing.id));
  await writeAuditLog({
    actor,
    action: "group_class_opportunities.withdrawn",
    entityType: "group_class_application",
    entityId: existing.id,
    ipAddress: ip,
    metadata: { opportunityId },
  });
  const [row] = await db
    .select()
    .from(groupClassOpportunities)
    .where(eq(groupClassOpportunities.id, opportunityId))
    .limit(1);
  if (!row) {
    return { id: opportunityId, status: "withdrawn" as const };
  }
  const timeZone = await resolveDisplayTimeZone(actor.userId);
  const [view] = await hydrateOpportunities([row], timeZone, {
    teacherUserId: actor.userId,
  });
  return view;
}
