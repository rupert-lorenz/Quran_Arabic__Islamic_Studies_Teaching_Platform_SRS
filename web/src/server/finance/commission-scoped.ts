import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  currencies,
  groupLessons,
  liveCourses,
  users,
} from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { splitLessonRate } from "@/lib/teacher-rate-display";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";
import { formatMinorAmount } from "@/server/staff/money";
import { getTeacherRateLimits } from "@/server/teacher/profile";
import { listPricingControlWorkspace } from "@/server/teacher/pricing";

const COUNTED_GROUPS = ["published", "completed"] as const;
const COUNTED_COURSES = ["published", "completed"] as const;

type Money = Awaited<ReturnType<typeof getRequestMoney>>;
type Limits = Awaited<ReturnType<typeof getTeacherRateLimits>>;
type Scope = "teacher" | "country" | "course" | "class";

function conversionActive(money: Money) {
  return (
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code))
  );
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

function bandExampleMinor(
  platformMin: number,
  minMinor: number | null,
  maxMinor: number | null,
) {
  let amount = Math.max(0, platformMin);
  if (minMinor != null) {
    amount = Math.max(amount, minMinor);
  }
  if (maxMinor != null) {
    amount = Math.min(amount, maxMinor);
  }
  return Math.max(0, amount);
}

function emptyFaculty(money: Money, limits: Limits) {
  return {
    display: money.currency,
    conversionActive: conversionActive(money),
    percent: limits.commissionPercent,
    hasFixed: limits.commissionFixedMinor > 0,
    fixedFormatted: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    counts: {
      teacher: 0,
      country: 0,
      course: 0,
      class: 0,
    },
    recent: [] as Array<{
      id: string;
      scope: Scope;
      label: string;
      teacherName: string | null;
      createdAt: string;
      grossFormatted: string;
      commissionFormatted: string;
      netFormatted: string;
      listedGrossFormatted: string | null;
    }>,
  };
}

export async function getCommissionScopedFaculty(actor: ApiActor) {
  const [money, limits] = await Promise.all([
    getRequestMoney(),
    getTeacherRateLimits(),
  ]);
  if (actor.roleKey === "parent" || actor.roleKey === "student") {
    return emptyFaculty(money, limits);
  }

  const listing = limits.currency ?? {
    code: money.currency.code,
    symbol: money.currency.symbol,
    decimalPlaces: money.currency.decimalPlaces,
  };
  const teacherOnly =
    actor.roleKey === "teacher" ? eq(liveCourses.teacherUserId, actor.userId) : undefined;
  const classTeacher =
    actor.roleKey === "teacher"
      ? eq(groupLessons.teacherUserId, actor.userId)
      : undefined;
  const courseWhere = teacherOnly
    ? and(teacherOnly, inArray(liveCourses.status, [...COUNTED_COURSES]))
    : inArray(liveCourses.status, [...COUNTED_COURSES]);
  const classWhere = classTeacher
    ? and(
        classTeacher,
        isNull(groupLessons.liveCourseId),
        inArray(groupLessons.status, [...COUNTED_GROUPS]),
      )
    : and(
        isNull(groupLessons.liveCourseId),
        inArray(groupLessons.status, [...COUNTED_GROUPS]),
      );

  const [workspace, teacherRow, courseRows, classRows, courseCount, classCount] =
    await Promise.all([
    listPricingControlWorkspace(limits),
    actor.roleKey === "teacher"
      ? db
          .select({ country: users.country, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, actor.userId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({
        id: liveCourses.id,
        title: liveCourses.title,
        amountMinor: liveCourses.amountMinor,
        currencyCode: liveCourses.currencyCode,
        firstStartsAt: liveCourses.firstStartsAt,
        teacherName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(liveCourses)
      .innerJoin(currencies, eq(liveCourses.currencyCode, currencies.code))
      .leftJoin(users, eq(users.id, liveCourses.teacherUserId))
      .where(courseWhere)
      .orderBy(desc(liveCourses.firstStartsAt))
      .limit(40),
    db
      .select({
        id: groupLessons.id,
        title: groupLessons.title,
        amountMinor: groupLessons.amountMinor,
        currencyCode: groupLessons.currencyCode,
        startsAt: groupLessons.startsAt,
        teacherName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(groupLessons)
      .innerJoin(currencies, eq(groupLessons.currencyCode, currencies.code))
      .leftJoin(users, eq(users.id, groupLessons.teacherUserId))
      .where(classWhere)
      .orderBy(desc(groupLessons.startsAt))
      .limit(40),
    db
      .select({ n: count() })
      .from(liveCourses)
      .where(courseWhere)
      .then((rows) => Number(rows[0]?.n ?? 0)),
    db
      .select({ n: count() })
      .from(groupLessons)
      .where(classWhere)
      .then((rows) => Number(rows[0]?.n ?? 0)),
  ]);

  const teacherRules = workspace.rules.filter((rule) => {
    if (rule.scope !== "teacher") {
      return false;
    }
    return actor.roleKey === "teacher" ? rule.scopeKey === actor.userId : true;
  });
  const countryRules = workspace.rules.filter((rule) => {
    if (rule.scope !== "country") {
      return false;
    }
    return actor.roleKey === "teacher"
      ? Boolean(teacherRow?.country && rule.scopeKey === teacherRow.country)
      : true;
  });

  const recent: ReturnType<typeof emptyFaculty>["recent"] = [];

  const addBand = (
    id: string,
    scope: "teacher" | "country",
    label: string,
    teacherName: string | null,
    createdAt: Date,
    minMinor: number | null,
    maxMinor: number | null,
  ) => {
    const amountMinor = bandExampleMinor(
      limits.minMinor,
      minMinor,
      maxMinor,
    );
    const price = presentSplit(money, limits, {
      amountMinor,
      currencyCode: listing.code,
      decimalPlaces: listing.decimalPlaces,
      symbol: listing.symbol,
    });
    recent.push({
      id,
      scope,
      label,
      teacherName,
      createdAt: createdAt.toISOString(),
      grossFormatted: price.gross.studentPriceFormatted,
      commissionFormatted: price.commission.studentPriceFormatted,
      netFormatted: price.net.studentPriceFormatted,
      listedGrossFormatted: price.gross.listedPriceFormatted,
    });
  };

  for (const rule of teacherRules) {
    addBand(
      rule.id,
      "teacher",
      rule.label,
      rule.label,
      rule.updatedAt,
      rule.minMinor,
      rule.maxMinor,
    );
  }
  for (const rule of countryRules) {
    addBand(
      rule.id,
      "country",
      rule.label,
      teacherRow?.displayName ?? null,
      rule.updatedAt,
      rule.minMinor,
      rule.maxMinor,
    );
  }
  for (const row of courseRows) {
    const price = presentSplit(money, limits, row);
    recent.push({
      id: row.id,
      scope: "course",
      label: row.title,
      teacherName: row.teacherName,
      createdAt: row.firstStartsAt.toISOString(),
      grossFormatted: price.gross.studentPriceFormatted,
      commissionFormatted: price.commission.studentPriceFormatted,
      netFormatted: price.net.studentPriceFormatted,
      listedGrossFormatted: price.gross.listedPriceFormatted,
    });
  }
  for (const row of classRows) {
    const price = presentSplit(money, limits, row);
    recent.push({
      id: row.id,
      scope: "class",
      label: row.title,
      teacherName: row.teacherName,
      createdAt: row.startsAt.toISOString(),
      grossFormatted: price.gross.studentPriceFormatted,
      commissionFormatted: price.commission.studentPriceFormatted,
      netFormatted: price.net.studentPriceFormatted,
      listedGrossFormatted: price.gross.listedPriceFormatted,
    });
  }

  recent.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return {
    display: money.currency,
    conversionActive: conversionActive(money),
    percent: limits.commissionPercent,
    hasFixed: limits.commissionFixedMinor > 0,
    fixedFormatted: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    counts: {
      teacher: teacherRules.length,
      country: countryRules.length,
      course: courseCount,
      class: classCount,
    },
    recent: recent.slice(0, 12),
  };
}
