import { and, count, desc, eq, inArray, isNotNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookingPackages, bookings, currencies, subjects, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";

const COUNTED = ["active", "completed"] as const;
const SITTINGS = ["confirmed", "completed", "no_show"] as const;

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  if (actor.roleKey === "teacher") {
    return eq(bookingPackages.teacherUserId, actor.userId);
  }
  if (actor.roleKey === "parent") {
    return eq(bookingPackages.bookedByUserId, actor.userId);
  }
  if (actor.roleKey === "student") {
    return eq(bookingPackages.studentUserId, actor.userId);
  }
  return eq(bookingPackages.bookedByUserId, actor.userId);
}

function bookingScopeFor(actor: ApiActor): SQL | undefined {
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

function packageWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope
    ? and(scope, inArray(bookingPackages.status, [...COUNTED]))
    : inArray(bookingPackages.status, [...COUNTED]);
  return extra ? and(base, extra) : base;
}

function sittingWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope
    ? and(scope, isNotNull(bookings.packageId), inArray(bookings.status, [...SITTINGS]))
    : and(isNotNull(bookings.packageId), inArray(bookings.status, [...SITTINGS]));
  return extra ? and(base, extra) : base;
}

export async function getBlockBookingsFaculty(actor: ApiActor) {
  const scope = scopeFor(actor);
  const bookingScope = bookingScopeFor(actor);
  const counted = packageWhere(scope);
  const [
    money,
    packages,
    active,
    completed,
    cancelled,
    sittings,
    remaining,
    done,
    sizeRows,
    recentRows,
  ] = await Promise.all([
    getRequestMoney(),
    db.select({ value: count() }).from(bookingPackages).where(counted),
    db
      .select({ value: count() })
      .from(bookingPackages)
      .where(
        scope
          ? and(scope, eq(bookingPackages.status, "active"))
          : eq(bookingPackages.status, "active"),
      ),
    db
      .select({ value: count() })
      .from(bookingPackages)
      .where(
        scope
          ? and(scope, eq(bookingPackages.status, "completed"))
          : eq(bookingPackages.status, "completed"),
      ),
    db
      .select({ value: count() })
      .from(bookingPackages)
      .where(
        scope
          ? and(scope, eq(bookingPackages.status, "cancelled"))
          : eq(bookingPackages.status, "cancelled"),
      ),
    db.select({ value: count() }).from(bookings).where(sittingWhere(bookingScope)),
    db
      .select({ value: count() })
      .from(bookings)
      .where(sittingWhere(bookingScope, eq(bookings.status, "confirmed"))),
    db
      .select({ value: count() })
      .from(bookings)
      .where(
        sittingWhere(
          bookingScope,
          inArray(bookings.status, ["completed", "no_show"]),
        ),
      ),
    db
      .select({
        lessonCount: bookingPackages.lessonCount,
        value: count(),
      })
      .from(bookingPackages)
      .where(counted)
      .groupBy(bookingPackages.lessonCount),
    db
      .select({
        id: bookingPackages.id,
        status: bookingPackages.status,
        lessonCount: bookingPackages.lessonCount,
        discountPercent: bookingPackages.discountPercent,
        totalAmountMinor: bookingPackages.totalAmountMinor,
        currencyCode: bookingPackages.currencyCode,
        subjectName: subjects.name,
        studentName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(bookingPackages)
      .innerJoin(currencies, eq(bookingPackages.currencyCode, currencies.code))
      .innerJoin(subjects, eq(bookingPackages.subjectSlug, subjects.slug))
      .innerJoin(users, eq(bookingPackages.studentUserId, users.id))
      .where(counted)
      .orderBy(desc(bookingPackages.createdAt))
      .limit(8),
  ]);

  const recentIds = recentRows.map((row) => row.id);
  const sittingRows = recentIds.length
    ? await db
        .select({
          packageId: bookings.packageId,
          status: bookings.status,
        })
        .from(bookings)
        .where(and(inArray(bookings.packageId, recentIds), inArray(bookings.status, [...SITTINGS])))
    : [];
  const remainingByPackage = new Map<string, number>();
  const doneByPackage = new Map<string, number>();
  for (const row of sittingRows) {
    if (!row.packageId) continue;
    if (row.status === "confirmed") {
      remainingByPackage.set(row.packageId, (remainingByPackage.get(row.packageId) ?? 0) + 1);
    } else {
      doneByPackage.set(row.packageId, (doneByPackage.get(row.packageId) ?? 0) + 1);
    }
  }

  const sizeCounts = new Map(sizeRows.map((row) => [row.lessonCount, row.value]));
  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));

  return {
    display: money.currency,
    conversionActive,
    counts: {
      packages: packages[0]?.value ?? 0,
      active: active[0]?.value ?? 0,
      completed: completed[0]?.value ?? 0,
      cancelled: cancelled[0]?.value ?? 0,
      sittings: sittings[0]?.value ?? 0,
      remaining: remaining[0]?.value ?? 0,
      done: done[0]?.value ?? 0,
      four: sizeCounts.get(4) ?? 0,
      eight: sizeCounts.get(8) ?? 0,
      twelve: sizeCounts.get(12) ?? 0,
    },
    recent: recentRows.map((row) => {
      const listing = {
        code: row.currencyCode,
        symbol: row.symbol,
        decimalPlaces: row.decimalPlaces,
      };
      const price = presentStudentAmount({
        amountMinor: row.totalAmountMinor,
        listing,
        display: money.currency,
        convert: money.convert,
      });
      return {
        id: row.id,
        status: row.status,
        lessonCount: row.lessonCount,
        discountPercent: row.discountPercent,
        subjectName: row.subjectName,
        studentName: row.studentName,
        remaining: remainingByPackage.get(row.id) ?? 0,
        done: doneByPackage.get(row.id) ?? 0,
        amountFormatted: price.studentPriceFormatted,
        listedPriceFormatted: price.listedPriceFormatted,
        priceConverted: price.priceConverted,
      };
    }),
  };
}
