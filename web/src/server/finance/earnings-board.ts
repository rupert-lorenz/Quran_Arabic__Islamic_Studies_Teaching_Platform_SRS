import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  currencies,
  financeOperations,
  groupLessonEnrollments,
  groupLessons,
  liveCourseEnrollments,
  liveCourses,
  users,
} from "@/db/schema";
import { splitLessonRate } from "@/lib/teacher-rate-display";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { formatMinorAmount } from "@/server/staff/money";
import { getTeacherRateLimits } from "@/server/teacher/profile";

const EARNED_BOOKING = new Set(["completed", "no_show"]);
const OPEN_BOOKING = new Set(["confirmed"]);
const WALLET_PENDING = new Set(["open", "in_review", "approved"]);

type Bucket = Map<string, number>;

function add(map: Bucket, code: string, amount: number) {
  map.set(code, (map.get(code) ?? 0) + amount);
}

function labels(
  totals: Bucket,
  currencyByCode: Map<string, { decimalPlaces: number; symbol: string }>,
) {
  return [...totals.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, amount]) => {
      const currency = currencyByCode.get(code);
      return currency
        ? formatMinorAmount(amount, currency.decimalPlaces, currency.symbol)
        : `${amount} ${code}`;
    });
}

function joined(items: string[], zero: string) {
  return items.length ? items.join(" · ") : zero;
}

function empty(zero: string) {
  return {
    dashboard: {
      lineCount: 0,
      teacherCount: 0,
      pendingLabel: zero,
      availableLabel: zero,
      recent: [] as Array<{
        id: string;
        source: string;
        status: string;
        teacherName: string | null;
        grossLabel: string;
        netLabel: string;
        pending: boolean;
      }>,
    },
    split: {
      grossLabel: zero,
      commissionLabel: zero,
      netLabel: zero,
      pendingLabel: zero,
      availableLabel: zero,
      paidLabel: zero,
    },
  };
}

export async function getEarningsFaculties(actor: ApiActor) {
  const limits = await getTeacherRateLimits();
  const zero = limits.currency
    ? formatMinorAmount(0, limits.currency.decimalPlaces, limits.currency.symbol)
    : "0";
  if (
    actor.roleKey === "parent" ||
    actor.roleKey === "student" ||
    (!isStaffRole(actor.roleKey) && actor.roleKey !== "teacher")
  ) {
    return empty(zero);
  }

  const teacherId = actor.roleKey === "teacher" ? actor.userId : null;
  const lessonWhere = teacherId
    ? and(
        eq(bookings.teacherUserId, teacherId),
        inArray(bookings.status, ["confirmed", "completed", "no_show"]),
      )
    : inArray(bookings.status, ["confirmed", "completed", "no_show"]);
  const groupWhere = teacherId
    ? and(
        eq(groupLessons.teacherUserId, teacherId),
        inArray(groupLessons.status, ["published", "completed"]),
      )
    : inArray(groupLessons.status, ["published", "completed"]);
  const courseWhere = teacherId
    ? and(
        eq(liveCourses.teacherUserId, teacherId),
        inArray(liveCourseEnrollments.status, ["confirmed", "completed"]),
      )
    : inArray(liveCourseEnrollments.status, ["confirmed", "completed"]);
  const payoutWhere = teacherId
    ? and(
        eq(financeOperations.kind, "payout"),
        or(
          eq(financeOperations.counterpartyUserId, teacherId),
          eq(financeOperations.createdByUserId, teacherId),
        ),
      )
    : eq(financeOperations.kind, "payout");

  const [currencyRows, lessonRows, groupRows, courseRows, payoutRows] =
    await Promise.all([
      db
        .select({
          code: currencies.code,
          symbol: currencies.symbol,
          decimalPlaces: currencies.decimalPlaces,
        })
        .from(currencies)
        .where(eq(currencies.isEnabled, true)),
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
        .where(lessonWhere)
        .orderBy(desc(bookings.startsAt))
        .limit(200),
      db
        .select({
          id: groupLessons.id,
          status: groupLessons.status,
          startsAt: groupLessons.startsAt,
          amountMinor: groupLessons.amountMinor,
          teacherPaymentMinor: groupLessons.teacherPaymentMinor,
          currencyCode: groupLessons.currencyCode,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
          teacherName: users.displayName,
          enrollmentAmountMinor: groupLessonEnrollments.amountMinor,
          enrollmentStatus: groupLessonEnrollments.status,
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
        .innerJoin(currencies, eq(liveCourseEnrollments.currencyCode, currencies.code))
        .leftJoin(users, eq(users.id, liveCourses.teacherUserId))
        .where(courseWhere)
        .orderBy(desc(liveCourseEnrollments.createdAt))
        .limit(200),
      db
        .select({
          status: financeOperations.status,
          amountMinor: financeOperations.amountMinor,
          currencyCode: financeOperations.currencyCode,
        })
        .from(financeOperations)
        .where(payoutWhere),
    ]);

  const byCode = new Map(currencyRows.map((row) => [row.code, row]));
  const gross: Bucket = new Map();
  const commission: Bucket = new Map();
  const net: Bucket = new Map();
  const pending: Bucket = new Map();
  const earned: Bucket = new Map();
  const teachers = new Set<string>();
  const recent: ReturnType<typeof empty>["dashboard"]["recent"] = [];

  for (const row of lessonRows) {
    const split = splitLessonRate(
      row.amountMinor,
      limits.commissionPercent,
      limits.commissionFixedMinor,
    );
    add(gross, row.currencyCode, row.amountMinor);
    add(commission, row.currencyCode, split.commissionMinor);
    add(net, row.currencyCode, split.teacherEarnsMinor);
    const isPending = OPEN_BOOKING.has(row.status);
    add(isPending ? pending : earned, row.currencyCode, split.teacherEarnsMinor);
    if (row.teacherName) teachers.add(row.teacherName);
    if (EARNED_BOOKING.has(row.status) || OPEN_BOOKING.has(row.status)) {
      recent.push({
        id: row.id,
        source: row.packageId ? "block" : "hourly",
        status: row.status,
        teacherName: row.teacherName,
        grossLabel: formatMinorAmount(row.amountMinor, row.decimalPlaces, row.symbol),
        netLabel: formatMinorAmount(
          split.teacherEarnsMinor,
          row.decimalPlaces,
          row.symbol,
        ),
        pending: isPending,
      });
    }
  }

  const grouped = new Map<
    string,
    {
      id: string;
      status: string;
      startsAt: Date;
      teacherPaymentMinor: number | null;
      currencyCode: string;
      decimalPlaces: number;
      symbol: string;
      teacherName: string | null;
      enrollmentTotal: number;
    }
  >();
  for (const row of groupRows) {
    const current = grouped.get(row.id) ?? {
      id: row.id,
      status: row.status,
      startsAt: row.startsAt,
      teacherPaymentMinor: row.teacherPaymentMinor,
      currencyCode: row.currencyCode,
      decimalPlaces: row.decimalPlaces,
      symbol: row.symbol,
      teacherName: row.teacherName,
      enrollmentTotal: 0,
    };
    if (
      row.enrollmentStatus &&
      ["confirmed", "completed"].includes(row.enrollmentStatus)
    ) {
      current.enrollmentTotal += row.enrollmentAmountMinor ?? 0;
    }
    grouped.set(row.id, current);
  }

  for (const row of grouped.values()) {
    if (row.enrollmentTotal <= 0) continue;
    const split = splitLessonRate(
      row.enrollmentTotal,
      limits.commissionPercent,
      limits.commissionFixedMinor,
    );
    const listed = row.teacherPaymentMinor;
    const teacherEarnsMinor = listed != null ? listed : split.teacherEarnsMinor;
    const commissionMinor =
      listed != null
        ? Math.max(0, row.enrollmentTotal - teacherEarnsMinor)
        : split.commissionMinor;
    add(gross, row.currencyCode, Math.max(row.enrollmentTotal, teacherEarnsMinor));
    add(commission, row.currencyCode, commissionMinor);
    add(net, row.currencyCode, teacherEarnsMinor);
    const isPending = row.status === "published";
    add(isPending ? pending : earned, row.currencyCode, teacherEarnsMinor);
    if (row.teacherName) teachers.add(row.teacherName);
    recent.push({
      id: row.id,
      source: "group",
      status: row.status,
      teacherName: row.teacherName,
      grossLabel: formatMinorAmount(
        row.enrollmentTotal,
        row.decimalPlaces,
        row.symbol,
      ),
      netLabel: formatMinorAmount(
        teacherEarnsMinor,
        row.decimalPlaces,
        row.symbol,
      ),
      pending: isPending,
    });
  }

  for (const row of courseRows) {
    const split = splitLessonRate(
      row.amountMinor,
      limits.commissionPercent,
      limits.commissionFixedMinor,
    );
    add(gross, row.currencyCode, row.amountMinor);
    add(commission, row.currencyCode, split.commissionMinor);
    add(net, row.currencyCode, split.teacherEarnsMinor);
    const isPending = row.status === "confirmed";
    add(isPending ? pending : earned, row.currencyCode, split.teacherEarnsMinor);
    if (row.teacherName) teachers.add(row.teacherName);
    recent.push({
      id: row.id,
      source: "course",
      status: row.status,
      teacherName: row.teacherName,
      grossLabel: formatMinorAmount(row.amountMinor, row.decimalPlaces, row.symbol),
      netLabel: formatMinorAmount(
        split.teacherEarnsMinor,
        row.decimalPlaces,
        row.symbol,
      ),
      pending: isPending,
    });
  }

  const paid: Bucket = new Map();
  const reserved: Bucket = new Map();
  for (const row of payoutRows) {
    if (row.status === "completed") add(paid, row.currencyCode, row.amountMinor);
    else if (WALLET_PENDING.has(row.status)) {
      add(reserved, row.currencyCode, row.amountMinor);
    }
  }
  const available: Bucket = new Map();
  for (const [code, amount] of earned) {
    available.set(
      code,
      Math.max(0, amount - (paid.get(code) ?? 0) - (reserved.get(code) ?? 0)),
    );
  }

  return {
    dashboard: {
      lineCount: recent.length,
      teacherCount: teacherId ? 1 : teachers.size,
      pendingLabel: joined(labels(pending, byCode), zero),
      availableLabel: joined(labels(available, byCode), zero),
      recent: recent.slice(0, 8),
    },
    split: {
      grossLabel: joined(labels(gross, byCode), zero),
      commissionLabel: joined(labels(commission, byCode), zero),
      netLabel: joined(labels(net, byCode), zero),
      pendingLabel: joined(labels(pending, byCode), zero),
      availableLabel: joined(labels(available, byCode), zero),
      paidLabel: joined(labels(paid, byCode), zero),
    },
  };
}
