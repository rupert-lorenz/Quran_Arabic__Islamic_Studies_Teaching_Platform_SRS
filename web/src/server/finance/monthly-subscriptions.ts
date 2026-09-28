import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  currencies,
  librarySubscriptionPlans,
  librarySubscriptions,
  parentChildren,
  users,
} from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { MONTHLY_SUBSCRIPTION_DAYS } from "@/server/lms/subscriptions";
import { getRequestMoney } from "@/server/money/currency";

function stillActive(now: Date): SQL {
  return and(
    eq(librarySubscriptions.status, "active"),
    or(isNull(librarySubscriptions.expiresAt), gt(librarySubscriptions.expiresAt, now)),
  )!;
}

async function learnerIdsFor(actor: ApiActor) {
  if (isStaffRole(actor.roleKey)) {
    return null;
  }
  if (actor.roleKey === "student") {
    return [actor.userId];
  }
  if (actor.roleKey === "parent") {
    const rows = await db
      .select({ id: parentChildren.childUserId })
      .from(parentChildren)
      .where(eq(parentChildren.parentUserId, actor.userId));
    return rows.map((row) => row.id);
  }
  return [];
}

function seatWhere(learnerIds: string[] | null, extra?: SQL) {
  const scope =
    learnerIds == null
      ? undefined
      : inArray(librarySubscriptions.studentUserId, learnerIds);
  if (!extra) return scope;
  return scope ? and(scope, extra) : extra;
}

function emptyFaculty(
  money: Awaited<ReturnType<typeof getRequestMoney>>,
  planCounts: { plans: number; priced: number; monthlyPlans: number },
) {
  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));
  return {
    display: money.currency,
    conversionActive,
    counts: {
      seats: 0,
      ended: 0,
      monthly: 0,
      complimentary: 0,
      ...planCounts,
    },
    recent: [] as Array<{
      id: string;
      planName: string;
      studentName: string;
      monthly: boolean;
      complimentary: boolean;
      amountFormatted: string | null;
      listedPriceFormatted: string | null;
      expiresAt: string | null;
      ended: boolean;
    }>,
  };
}

export async function getMonthlySubscriptionsFaculty(actor: ApiActor) {
  const now = new Date();
  const learnerIds = await learnerIdsFor(actor);
  const catalogue = isStaffRole(actor.roleKey) || actor.roleKey === "teacher";
  if (learnerIds !== null && learnerIds.length === 0 && !catalogue) {
    return emptyFaculty(await getRequestMoney(), {
      plans: 0,
      priced: 0,
      monthlyPlans: 0,
    });
  }
  const active = stillActive(now);
  if (learnerIds !== null && learnerIds.length === 0) {
    const [money, planRows] = await Promise.all([
      getRequestMoney(),
      db
        .select({
          key: librarySubscriptionPlans.key,
          enabled: librarySubscriptionPlans.isEnabled,
          defaultDays: librarySubscriptionPlans.defaultDays,
          amountMinor: librarySubscriptionPlans.amountMinor,
        })
        .from(librarySubscriptionPlans),
    ]);
    const visiblePlans = planRows.filter((row) => row.enabled);
    return emptyFaculty(money, {
      plans: visiblePlans.length,
      priced: visiblePlans.filter((row) => row.amountMinor > 0).length,
      monthlyPlans: visiblePlans.filter(
        (row) => row.defaultDays === MONTHLY_SUBSCRIPTION_DAYS,
      ).length,
    });
  }
  const [
    money,
    seats,
    ended,
    monthly,
    complimentary,
    planRows,
    recentRows,
  ] = await Promise.all([
    getRequestMoney(),
    db.select({ value: count() }).from(librarySubscriptions).where(seatWhere(learnerIds, active)),
    db
      .select({ value: count() })
      .from(librarySubscriptions)
      .where(
        seatWhere(
          learnerIds,
          or(
            eq(librarySubscriptions.status, "ended"),
            and(
              eq(librarySubscriptions.status, "active"),
              isNotNull(librarySubscriptions.expiresAt),
              lte(librarySubscriptions.expiresAt, now),
            ),
          ),
        ),
      ),
    db
      .select({ value: count() })
      .from(librarySubscriptions)
      .innerJoin(
        librarySubscriptionPlans,
        eq(librarySubscriptionPlans.key, librarySubscriptions.planKey),
      )
      .where(
        seatWhere(
          learnerIds,
          and(active, eq(librarySubscriptionPlans.defaultDays, MONTHLY_SUBSCRIPTION_DAYS)),
        ),
      ),
    db
      .select({ value: count() })
      .from(librarySubscriptions)
      .where(seatWhere(learnerIds, and(active, eq(librarySubscriptions.amountMinor, 0)))),
    catalogue
      ? db
          .select({
            key: librarySubscriptionPlans.key,
            enabled: librarySubscriptionPlans.isEnabled,
            defaultDays: librarySubscriptionPlans.defaultDays,
            amountMinor: librarySubscriptionPlans.amountMinor,
          })
          .from(librarySubscriptionPlans)
      : db
          .select({
            key: librarySubscriptions.planKey,
            enabled: librarySubscriptionPlans.isEnabled,
            defaultDays: librarySubscriptionPlans.defaultDays,
            amountMinor: librarySubscriptions.amountMinor,
          })
          .from(librarySubscriptions)
          .innerJoin(
            librarySubscriptionPlans,
            eq(librarySubscriptionPlans.key, librarySubscriptions.planKey),
          )
          .where(seatWhere(learnerIds)),
    db
      .select({
        id: librarySubscriptions.id,
        status: librarySubscriptions.status,
        expiresAt: librarySubscriptions.expiresAt,
        amountMinor: librarySubscriptions.amountMinor,
        currencyCode: librarySubscriptions.currencyCode,
        planName: librarySubscriptionPlans.name,
        defaultDays: librarySubscriptionPlans.defaultDays,
        studentName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(librarySubscriptions)
      .innerJoin(
        librarySubscriptionPlans,
        eq(librarySubscriptionPlans.key, librarySubscriptions.planKey),
      )
      .innerJoin(users, eq(users.id, librarySubscriptions.studentUserId))
      .leftJoin(currencies, eq(librarySubscriptions.currencyCode, currencies.code))
      .where(seatWhere(learnerIds))
      .orderBy(desc(librarySubscriptions.createdAt))
      .limit(8),
  ]);

  const visiblePlans = catalogue
    ? planRows.filter((row) => row.enabled)
    : [...new Map(planRows.map((row) => [row.key, row])).values()];

  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));

  return {
    display: money.currency,
    conversionActive,
    counts: {
      seats: seats[0]?.value ?? 0,
      ended: ended[0]?.value ?? 0,
      monthly: monthly[0]?.value ?? 0,
      complimentary: complimentary[0]?.value ?? 0,
      plans: visiblePlans.length,
      priced: visiblePlans.filter((row) => row.amountMinor > 0).length,
      monthlyPlans: visiblePlans.filter(
        (row) => row.defaultDays === MONTHLY_SUBSCRIPTION_DAYS,
      ).length,
    },
    recent: recentRows.map((row) => {
      const listing =
        row.currencyCode && row.symbol != null && row.decimalPlaces != null
          ? {
              code: row.currencyCode,
              symbol: row.symbol,
              decimalPlaces: row.decimalPlaces,
            }
          : null;
      const price = presentStudentAmount({
        amountMinor: row.amountMinor,
        listing,
        display: money.currency,
        convert: money.convert,
      });
      const expired = Boolean(row.expiresAt && row.expiresAt.getTime() <= now.getTime());
      return {
        id: row.id,
        planName: row.planName,
        studentName: row.studentName,
        monthly: row.defaultDays === MONTHLY_SUBSCRIPTION_DAYS,
        complimentary: row.amountMinor <= 0,
        amountFormatted: row.amountMinor > 0 ? price.studentPriceFormatted : null,
        listedPriceFormatted: row.amountMinor > 0 ? price.listedPriceFormatted : null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        ended: row.status === "ended" || expired,
      };
    }),
  };
}
