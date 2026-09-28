import { and, count, countDistinct, desc, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { currencies, groupLessonEnrollments, groupLessons, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";

const COUNTED = ["confirmed", "completed"] as const;
const STANDALONE = isNull(groupLessons.liveCourseId);

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  if (actor.roleKey === "teacher") {
    return eq(groupLessons.teacherUserId, actor.userId);
  }
  if (actor.roleKey === "student") {
    return eq(groupLessonEnrollments.studentUserId, actor.userId);
  }
  return eq(groupLessonEnrollments.bookedByUserId, actor.userId);
}

function enrollmentWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope
    ? and(scope, STANDALONE, inArray(groupLessonEnrollments.status, [...COUNTED]))
    : and(STANDALONE, inArray(groupLessonEnrollments.status, [...COUNTED]));
  return extra ? and(base, extra) : base;
}

function anyWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope ? and(scope, STANDALONE) : STANDALONE;
  return extra ? and(base, extra) : base;
}

export async function getGroupClassPaymentsFaculty(actor: ApiActor) {
  const scope = scopeFor(actor);
  const catalogue = isStaffRole(actor.roleKey) || actor.roleKey === "teacher";
  const counted = enrollmentWhere(scope);
  const [
    money,
    payments,
    open,
    completed,
    cancelled,
    waitlisted,
    complimentary,
    series,
    classRows,
    recentRows,
  ] = await Promise.all([
    getRequestMoney(),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(counted),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(anyWhere(scope, eq(groupLessonEnrollments.status, "confirmed"))),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(anyWhere(scope, eq(groupLessonEnrollments.status, "completed"))),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(anyWhere(scope, eq(groupLessonEnrollments.status, "cancelled"))),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(anyWhere(scope, eq(groupLessonEnrollments.status, "waitlisted"))),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(enrollmentWhere(scope, eq(groupLessonEnrollments.amountMinor, 0))),
    db
      .select({ value: count() })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(enrollmentWhere(scope, isNotNull(groupLessons.seriesId))),
    catalogue
      ? db
          .select({ value: count() })
          .from(groupLessons)
          .where(
            actor.roleKey === "teacher"
              ? and(
                  eq(groupLessons.teacherUserId, actor.userId),
                  STANDALONE,
                  eq(groupLessons.status, "published"),
                )
              : and(STANDALONE, eq(groupLessons.status, "published")),
          )
      : db
          .select({ value: countDistinct(groupLessonEnrollments.groupLessonId) })
          .from(groupLessonEnrollments)
          .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
          .where(anyWhere(scope)),
    db
      .select({
        id: groupLessonEnrollments.id,
        status: groupLessonEnrollments.status,
        amountMinor: groupLessonEnrollments.amountMinor,
        currencyCode: groupLessonEnrollments.currencyCode,
        durationMinutes: groupLessons.durationMinutes,
        title: groupLessons.title,
        seriesId: groupLessons.seriesId,
        studentName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .innerJoin(users, eq(users.id, groupLessonEnrollments.studentUserId))
      .innerJoin(currencies, eq(groupLessonEnrollments.currencyCode, currencies.code))
      .where(anyWhere(scope))
      .orderBy(desc(groupLessonEnrollments.createdAt))
      .limit(8),
  ]);

  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));

  return {
    display: money.currency,
    conversionActive,
    counts: {
      payments: payments[0]?.value ?? 0,
      open: open[0]?.value ?? 0,
      completed: completed[0]?.value ?? 0,
      cancelled: cancelled[0]?.value ?? 0,
      waitlisted: waitlisted[0]?.value ?? 0,
      complimentary: complimentary[0]?.value ?? 0,
      series: series[0]?.value ?? 0,
      classes: classRows[0]?.value ?? 0,
    },
    recent: recentRows.map((row) => {
      const price = presentStudentAmount({
        amountMinor: row.amountMinor,
        listing: {
          code: row.currencyCode,
          symbol: row.symbol,
          decimalPlaces: row.decimalPlaces,
        },
        display: money.currency,
        convert: money.convert,
      });
      return {
        id: row.id,
        title: row.title,
        studentName: row.studentName,
        durationMinutes: row.durationMinutes,
        series: Boolean(row.seriesId),
        complimentary: row.amountMinor <= 0,
        amountFormatted: row.amountMinor > 0 ? price.studentPriceFormatted : null,
        listedPriceFormatted: row.amountMinor > 0 ? price.listedPriceFormatted : null,
        status: row.status,
      };
    }),
  };
}
