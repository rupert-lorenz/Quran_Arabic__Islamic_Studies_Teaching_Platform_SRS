import { and, count, desc, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookings, currencies, subjects, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";

const COUNTED = ["confirmed", "completed", "no_show"] as const;

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  if (actor.roleKey === "teacher") {
    return eq(bookings.teacherUserId, actor.userId);
  }
  if (actor.roleKey === "parent") {
    return eq(bookings.bookedByUserId, actor.userId);
  }
  if (actor.roleKey === "student") {
    return eq(bookings.studentUserId, actor.userId);
  }
  return eq(bookings.bookedByUserId, actor.userId);
}

function singleWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope
    ? and(scope, isNull(bookings.packageId), inArray(bookings.status, [...COUNTED]))
    : and(isNull(bookings.packageId), inArray(bookings.status, [...COUNTED]));
  return extra ? and(base, extra) : base;
}

export async function getSinglePaymentsFaculty(actor: ApiActor) {
  const scope = scopeFor(actor);
  const counted = singleWhere(scope);
  const [money, payments, open, completed, oneOff, recurring, trial, recentRows] =
    await Promise.all([
      getRequestMoney(),
      db.select({ value: count() }).from(bookings).where(counted),
      db
        .select({ value: count() })
        .from(bookings)
        .where(
          scope
            ? and(scope, isNull(bookings.packageId), eq(bookings.status, "confirmed"))
            : and(isNull(bookings.packageId), eq(bookings.status, "confirmed")),
        ),
      db
        .select({ value: count() })
        .from(bookings)
        .where(
          scope
            ? and(scope, isNull(bookings.packageId), eq(bookings.status, "completed"))
            : and(isNull(bookings.packageId), eq(bookings.status, "completed")),
        ),
      db.select({ value: count() }).from(bookings).where(singleWhere(scope, isNull(bookings.seriesId))),
      db
        .select({ value: count() })
        .from(bookings)
        .where(singleWhere(scope, isNotNull(bookings.seriesId))),
      db
        .select({ value: count() })
        .from(bookings)
        .where(singleWhere(scope, eq(bookings.kind, "trial"))),
      db
        .select({
          id: bookings.id,
          kind: bookings.kind,
          status: bookings.status,
          durationMinutes: bookings.durationMinutes,
          amountMinor: bookings.amountMinor,
          currencyCode: bookings.currencyCode,
          seriesId: bookings.seriesId,
          subjectName: subjects.name,
          studentName: users.displayName,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
        })
        .from(bookings)
        .innerJoin(currencies, eq(bookings.currencyCode, currencies.code))
        .innerJoin(subjects, eq(bookings.subjectSlug, subjects.slug))
        .innerJoin(users, eq(bookings.studentUserId, users.id))
        .where(counted)
        .orderBy(desc(bookings.startsAt))
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
      oneOff: oneOff[0]?.value ?? 0,
      recurring: recurring[0]?.value ?? 0,
      trial: trial[0]?.value ?? 0,
    },
    recent: recentRows.map((row) => {
      const listing = {
        code: row.currencyCode,
        symbol: row.symbol,
        decimalPlaces: row.decimalPlaces,
      };
      const price = presentStudentAmount({
        amountMinor: row.amountMinor,
        listing,
        display: money.currency,
        convert: money.convert,
      });
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        durationMinutes: row.durationMinutes,
        subjectName: row.subjectName,
        studentName: row.studentName,
        amountFormatted: price.studentPriceFormatted,
        listedPriceFormatted: price.listedPriceFormatted,
        priceConverted: price.priceConverted,
        recurring: Boolean(row.seriesId),
        trial: row.kind === "trial",
      };
    }),
  };
}
