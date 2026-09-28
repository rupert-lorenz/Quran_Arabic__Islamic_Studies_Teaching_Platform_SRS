import { and, count, countDistinct, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { currencies, liveCourseEnrollments, liveCourses, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";

const COUNTED = ["confirmed", "completed"] as const;

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  if (actor.roleKey === "teacher") {
    return eq(liveCourses.teacherUserId, actor.userId);
  }
  if (actor.roleKey === "student") {
    return eq(liveCourseEnrollments.studentUserId, actor.userId);
  }
  return eq(liveCourseEnrollments.bookedByUserId, actor.userId);
}

function enrollmentWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope
    ? and(scope, inArray(liveCourseEnrollments.status, [...COUNTED]))
    : inArray(liveCourseEnrollments.status, [...COUNTED]);
  return extra ? and(base, extra) : base;
}

function anyWhere(scope: SQL | undefined, extra?: SQL) {
  if (!scope && !extra) return undefined;
  if (!scope) return extra;
  return extra ? and(scope, extra) : scope;
}

export async function getCoursePaymentsFaculty(actor: ApiActor) {
  const scope = scopeFor(actor);
  const catalogue = isStaffRole(actor.roleKey) || actor.roleKey === "teacher";
  const counted = enrollmentWhere(scope);
  const [
    money,
    payments,
    open,
    completed,
    cancelled,
    complimentary,
    courseRows,
    recentRows,
  ] = await Promise.all([
    getRequestMoney(),
    db
      .select({ value: count() })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(counted),
    db
      .select({ value: count() })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(
        scope
          ? and(scope, eq(liveCourseEnrollments.status, "confirmed"))
          : eq(liveCourseEnrollments.status, "confirmed"),
      ),
    db
      .select({ value: count() })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(
        scope
          ? and(scope, eq(liveCourseEnrollments.status, "completed"))
          : eq(liveCourseEnrollments.status, "completed"),
      ),
    db
      .select({ value: count() })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(anyWhere(scope, eq(liveCourseEnrollments.status, "cancelled"))),
    db
      .select({ value: count() })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .where(enrollmentWhere(scope, eq(liveCourseEnrollments.amountMinor, 0))),
    catalogue
      ? db
          .select({ value: count() })
          .from(liveCourses)
          .where(
            actor.roleKey === "teacher"
              ? and(
                  eq(liveCourses.teacherUserId, actor.userId),
                  eq(liveCourses.status, "published"),
                )
              : eq(liveCourses.status, "published"),
          )
      : db
          .select({ value: countDistinct(liveCourseEnrollments.liveCourseId) })
          .from(liveCourseEnrollments)
          .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
          .where(anyWhere(scope)),
    db
      .select({
        id: liveCourseEnrollments.id,
        status: liveCourseEnrollments.status,
        amountMinor: liveCourseEnrollments.amountMinor,
        currencyCode: liveCourseEnrollments.currencyCode,
        sessionCount: liveCourses.sessionCount,
        courseTitle: liveCourses.title,
        studentName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourses.id, liveCourseEnrollments.liveCourseId))
      .innerJoin(users, eq(users.id, liveCourseEnrollments.studentUserId))
      .innerJoin(currencies, eq(liveCourseEnrollments.currencyCode, currencies.code))
      .where(anyWhere(scope))
      .orderBy(desc(liveCourseEnrollments.createdAt))
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
      complimentary: complimentary[0]?.value ?? 0,
      courses: courseRows[0]?.value ?? 0,
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
        courseTitle: row.courseTitle,
        studentName: row.studentName,
        sessionCount: row.sessionCount,
        complimentary: row.amountMinor <= 0,
        amountFormatted: row.amountMinor > 0 ? price.studentPriceFormatted : null,
        listedPriceFormatted: row.amountMinor > 0 ? price.listedPriceFormatted : null,
        status: row.status,
      };
    }),
  };
}
