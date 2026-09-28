import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  currencies,
  groupLessonEnrollments,
  groupLessons,
  liveCourseEnrollments,
  liveCourses,
  users,
} from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { splitLessonRate } from "@/lib/teacher-rate-display";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";
import { formatMinorAmount } from "@/server/staff/money";
import { getTeacherRateLimits } from "@/server/teacher/profile";

const COUNTED_BOOKINGS = ["confirmed", "completed", "no_show"] as const;
const COUNTED_ENROLLMENTS = ["confirmed", "completed"] as const;
const COUNTED_GROUPS = ["published", "completed"] as const;

type Money = Awaited<ReturnType<typeof getRequestMoney>>;
type Limits = Awaited<ReturnType<typeof getTeacherRateLimits>>;
type Source = "hourly" | "block" | "group" | "course";

function emptyFaculty(money: Money, limits: Limits) {
  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));
  const zero = formatMinorAmount(
    0,
    money.currency.decimalPlaces,
    money.currency.symbol,
  );
  return {
    display: money.currency,
    conversionActive,
    percent: limits.commissionPercent,
    fixedFormatted: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    hasFixed: limits.commissionFixedMinor > 0,
    counts: {
      splits: 0,
      hourly: 0,
      block: 0,
      group: 0,
      course: 0,
    },
    totals: {
      grossFormatted: zero,
      commissionFormatted: zero,
      netFormatted: zero,
    },
    recent: [] as Array<{
      id: string;
      source: Source;
      status: string;
      teacherName: string | null;
      createdAt: string;
      grossFormatted: string;
      commissionFormatted: string;
      netFormatted: string;
      listedGrossFormatted: string | null;
    }>,
  };
}

function presentPart(
  money: Money,
  row: {
    amountMinor: number;
    currencyCode: string;
    decimalPlaces: number;
    symbol: string;
  },
) {
  return presentStudentAmount({
    amountMinor: row.amountMinor,
    listing: {
      code: row.currencyCode,
      symbol: row.symbol,
      decimalPlaces: row.decimalPlaces,
    },
    display: money.currency,
    convert: money.convert,
  });
}

function presentSplit(
  money: Money,
  limits: Limits,
  row: {
    amountMinor: number;
    currencyCode: string;
    decimalPlaces: number;
    symbol: string;
  },
) {
  const split = splitLessonRate(
    row.amountMinor,
    limits.commissionPercent,
    limits.commissionFixedMinor,
  );
  return {
    gross: presentPart(money, row),
    commission: presentPart(money, {
      ...row,
      amountMinor: split.commissionMinor,
    }),
    net: presentPart(money, {
      ...row,
      amountMinor: split.teacherEarnsMinor,
    }),
  };
}

export async function getCommissionAutoFaculty(actor: ApiActor) {
  const [money, limits] = await Promise.all([
    getRequestMoney(),
    getTeacherRateLimits(),
  ]);
  if (actor.roleKey === "parent" || actor.roleKey === "student") {
    return emptyFaculty(money, limits);
  }

  const teacherBooking =
    actor.roleKey === "teacher"
      ? eq(bookings.teacherUserId, actor.userId)
      : undefined;
  const teacherGroup =
    actor.roleKey === "teacher"
      ? eq(groupLessons.teacherUserId, actor.userId)
      : undefined;
  const teacherCourse =
    actor.roleKey === "teacher"
      ? eq(liveCourses.teacherUserId, actor.userId)
      : undefined;

  const bookingWhere = teacherBooking
    ? and(teacherBooking, inArray(bookings.status, [...COUNTED_BOOKINGS]))
    : inArray(bookings.status, [...COUNTED_BOOKINGS]);
  const groupWhere = teacherGroup
    ? and(
        teacherGroup,
        isNull(groupLessons.liveCourseId),
        inArray(groupLessons.status, [...COUNTED_GROUPS]),
      )
    : and(
        isNull(groupLessons.liveCourseId),
        inArray(groupLessons.status, [...COUNTED_GROUPS]),
      );
  const courseWhere = teacherCourse
    ? and(
        teacherCourse,
        inArray(liveCourseEnrollments.status, [...COUNTED_ENROLLMENTS]),
      )
    : inArray(liveCourseEnrollments.status, [...COUNTED_ENROLLMENTS]);

  const [lessonRows, groupRows, courseRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        amountMinor: bookings.amountMinor,
        currencyCode: bookings.currencyCode,
        packageId: bookings.packageId,
        startsAt: bookings.startsAt,
        teacherName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(bookings)
      .innerJoin(currencies, eq(bookings.currencyCode, currencies.code))
      .leftJoin(users, eq(users.id, bookings.teacherUserId))
      .where(bookingWhere)
      .orderBy(desc(bookings.startsAt)),
    db
      .select({
        id: groupLessons.id,
        status: groupLessons.status,
        startsAt: groupLessons.startsAt,
        currencyCode: groupLessons.currencyCode,
        teacherName: users.displayName,
        enrollmentAmountMinor: groupLessonEnrollments.amountMinor,
        enrollmentStatus: groupLessonEnrollments.status,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(groupLessons)
      .innerJoin(currencies, eq(groupLessons.currencyCode, currencies.code))
      .leftJoin(users, eq(users.id, groupLessons.teacherUserId))
      .leftJoin(
        groupLessonEnrollments,
        eq(groupLessonEnrollments.groupLessonId, groupLessons.id),
      )
      .where(groupWhere),
    db
      .select({
        id: liveCourseEnrollments.id,
        status: liveCourseEnrollments.status,
        amountMinor: liveCourseEnrollments.amountMinor,
        currencyCode: liveCourseEnrollments.currencyCode,
        createdAt: liveCourseEnrollments.createdAt,
        teacherName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourseEnrollments.liveCourseId, liveCourses.id))
      .innerJoin(
        currencies,
        eq(liveCourseEnrollments.currencyCode, currencies.code),
      )
      .leftJoin(users, eq(users.id, liveCourses.teacherUserId))
      .where(courseWhere)
      .orderBy(desc(liveCourseEnrollments.createdAt)),
  ]);

  let grossMinor = 0;
  let commissionMinor = 0;
  let netMinor = 0;
  let hourly = 0;
  let block = 0;
  let group = 0;
  let course = 0;
  const recent: ReturnType<typeof emptyFaculty>["recent"] = [];

  const addLine = (
    id: string,
    source: Source,
    status: string,
    teacherName: string | null,
    createdAt: Date,
    row: {
      amountMinor: number;
      currencyCode: string;
      decimalPlaces: number;
      symbol: string;
    },
  ) => {
    const price = presentSplit(money, limits, row);
    grossMinor += price.gross.studentPriceMinor;
    commissionMinor += price.commission.studentPriceMinor;
    netMinor += price.net.studentPriceMinor;
    if (source === "hourly") hourly += 1;
    if (source === "block") block += 1;
    if (source === "group") group += 1;
    if (source === "course") course += 1;
    recent.push({
      id,
      source,
      status,
      teacherName,
      createdAt: createdAt.toISOString(),
      grossFormatted: price.gross.studentPriceFormatted,
      commissionFormatted: price.commission.studentPriceFormatted,
      netFormatted: price.net.studentPriceFormatted,
      listedGrossFormatted: price.gross.listedPriceFormatted,
    });
  };

  for (const row of lessonRows) {
    addLine(
      row.id,
      row.packageId ? "block" : "hourly",
      row.status,
      row.teacherName,
      row.startsAt,
      row,
    );
  }

  const grouped = new Map<
    string,
    {
      id: string;
      status: string;
      startsAt: Date;
      amountMinor: number;
      enrollments: number;
      currencyCode: string;
      teacherName: string | null;
      decimalPlaces: number;
      symbol: string;
    }
  >();
  for (const row of groupRows) {
    const current = grouped.get(row.id) ?? {
      id: row.id,
      status: row.status,
      startsAt: row.startsAt,
      amountMinor: 0,
      enrollments: 0,
      currencyCode: row.currencyCode,
      teacherName: row.teacherName,
      decimalPlaces: row.decimalPlaces,
      symbol: row.symbol,
    };
    if (
      row.enrollmentStatus &&
      COUNTED_ENROLLMENTS.includes(
        row.enrollmentStatus as (typeof COUNTED_ENROLLMENTS)[number],
      )
    ) {
      current.amountMinor += row.enrollmentAmountMinor ?? 0;
      current.enrollments += 1;
    }
    grouped.set(row.id, current);
  }
  for (const row of grouped.values()) {
    if (row.enrollments === 0) {
      continue;
    }
    addLine(row.id, "group", row.status, row.teacherName, row.startsAt, row);
  }

  for (const row of courseRows) {
    addLine(
      row.id,
      "course",
      row.status,
      row.teacherName,
      row.createdAt,
      row,
    );
  }

  recent.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));

  return {
    display: money.currency,
    conversionActive,
    percent: limits.commissionPercent,
    fixedFormatted: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    hasFixed: limits.commissionFixedMinor > 0,
    counts: {
      splits: hourly + block + group + course,
      hourly,
      block,
      group,
      course,
    },
    totals: {
      grossFormatted: formatMinorAmount(
        grossMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
      commissionFormatted: formatMinorAmount(
        commissionMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
      netFormatted: formatMinorAmount(
        netMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
    },
    recent: recent.slice(0, 12),
  };
}
