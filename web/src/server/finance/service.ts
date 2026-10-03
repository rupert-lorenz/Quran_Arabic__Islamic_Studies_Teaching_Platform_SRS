import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookingPackages,
  bookings,
  currencies,
  financeOperations,
  groupLessonEnrollments,
  groupLessons,
  librarySubscriptions,
  liveCourseEnrollments,
  liveCourses,
  marketingCampaigns,
  parentChildren,
  pricingControls,
} from "@/db/schema";
import { listPaymentsModules } from "@/lib/payments-finance";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { splitLessonRate } from "@/lib/teacher-rate-display";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { listPaymentsAdapters } from "@/server/finance/adapter";
import type { RequestTeacherPayoutInput } from "@/server/finance/schemas";
import {
  listFinanceWorkspace,
  permissionForFinanceKind,
} from "@/server/staff/finance";
import { formatMinorAmount, parseMajorAmount } from "@/server/staff/money";
import { getBlockBookingsFaculty } from "@/server/finance/block-bookings";
import { getHourlyLessonsFaculty } from "@/server/finance/hourly-lessons";
import { getLocationPriceFaculty } from "@/server/finance/location-prices";
import { getMonthlySubscriptionsFaculty } from "@/server/finance/monthly-subscriptions";
import { getCoursePaymentsFaculty } from "@/server/finance/course-payments";
import { getCommissionAutoFaculty } from "@/server/finance/commission-auto";
import { getCommissionRulesFaculty } from "@/server/finance/commission-rules";
import { getCommissionScopedFaculty } from "@/server/finance/commission-scoped";
import { getCommunicationsFaculty } from "@/server/finance/communications";
import { getNoticeFaculties } from "@/server/finance/notice-faculties";
import { getSafeguardFaculties } from "@/server/quality/faculties";
import { getCrmFaculties } from "@/server/crm/faculties";
import { getMobileFaculties } from "@/server/mobile/faculties";
import { getInfrastructureFaculties } from "@/server/infrastructure/faculties";
import { getDocumentationFaculties } from "@/server/docs/faculties";
import { getHandoverFaculties } from "@/server/handover/faculties";
import { getTestingFaculties } from "@/server/testing/faculties";
import { getSecurityFaculties } from "@/server/security/faculties";
import { getEarningsFaculties } from "@/server/finance/earnings-board";
import { getOfferFaculties } from "@/server/finance/offer-faculties";
import { getSettlementFaculties } from "@/server/finance/settlement-faculties";
import { getCreditHistoryFaculty } from "@/server/finance/credit-history";
import { getCustomerWalletFaculty } from "@/server/finance/customer-wallet";
import { getGroupClassPaymentsFaculty } from "@/server/finance/group-class-payments";
import { getOneOffPaymentsFaculty } from "@/server/finance/one-off-payments";
import { getSinglePaymentsFaculty } from "@/server/finance/single-payments";
import { getCurrenciesFaculty } from "@/server/money/currency";
import { getTeacherRateLimits } from "@/server/teacher/profile";

const WALLET_PENDING = new Set(["open", "in_review", "approved"]);
const EARNED_BOOKING = new Set(["completed", "no_show"]);
const OPEN_BOOKING = new Set(["confirmed"]);

type MoneyRow = {
  amountMinor: number;
  currencyCode: string;
  decimalPlaces: number;
  symbol: string;
};

type DeskRole = "staff" | "teacher" | "parent";

function moneyLabel(row: Pick<MoneyRow, "amountMinor" | "decimalPlaces" | "symbol">) {
  return formatMinorAmount(row.amountMinor, row.decimalPlaces, row.symbol);
}

function emptyTotals() {
  return new Map<string, number>();
}

function addTotal(map: Map<string, number>, code: string, amount: number) {
  map.set(code, (map.get(code) ?? 0) + amount);
}

function formatTotals(
  totals: Map<string, number>,
  currencyByCode: Map<string, { decimalPlaces: number; symbol: string }>,
) {
  return [...totals.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, amountMinor]) => {
      const currency = currencyByCode.get(currencyCode);
      return {
        currencyCode,
        amountMinor,
        amountLabel: currency
          ? formatMinorAmount(amountMinor, currency.decimalPlaces, currency.symbol)
          : `${amountMinor} ${currencyCode}`,
      };
    });
}

function applyCommission(
  amountMinor: number,
  commissionPercent: number,
  commissionFixedMinor: number,
) {
  return splitLessonRate(amountMinor, commissionPercent, commissionFixedMinor);
}

async function loadEnabledCurrencies() {
  const rows = await db
    .select({
      code: currencies.code,
      name: currencies.name,
      symbol: currencies.symbol,
      decimalPlaces: currencies.decimalPlaces,
    })
    .from(currencies)
    .where(eq(currencies.isEnabled, true));
  return {
    rows,
    byCode: new Map(rows.map((row) => [row.code, row])),
  };
}

async function loadFamilyStudentIds(parentUserId: string) {
  const rows = await db
    .select({ childUserId: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, parentUserId));
  return rows.map((row) => row.childUserId);
}

async function loadCatalogueCounts() {
  const [
    hourly,
    blocks,
    subscriptions,
    courses,
    groups,
    oneOff,
    locationRules,
    referralCampaigns,
  ] = await Promise.all([
    db
      .select({ id: bookings.id, packageId: bookings.packageId })
      .from(bookings)
      .where(inArray(bookings.status, ["confirmed", "completed", "no_show"])),
    db
      .select({ id: bookingPackages.id })
      .from(bookingPackages)
      .where(inArray(bookingPackages.status, ["active", "completed"])),
    db
      .select({ id: librarySubscriptions.id })
      .from(librarySubscriptions)
      .where(eq(librarySubscriptions.status, "active")),
    db
      .select({ id: liveCourseEnrollments.id })
      .from(liveCourseEnrollments)
      .where(inArray(liveCourseEnrollments.status, ["confirmed", "completed"])),
    db
      .select({ id: groupLessonEnrollments.id })
      .from(groupLessonEnrollments)
      .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
      .where(
        and(
          inArray(groupLessonEnrollments.status, ["confirmed", "completed"]),
          isNull(groupLessons.liveCourseId),
        ),
      ),
    db
      .select({ id: financeOperations.id })
      .from(financeOperations)
      .where(eq(financeOperations.kind, "payment")),
    db.select({ id: pricingControls.id, scope: pricingControls.scope }).from(
      pricingControls,
    ),
    db
      .select({ id: marketingCampaigns.id })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.channel, "referral")),
  ]);

  return {
    hourly: hourly.length,
    single: hourly.filter((row) => !row.packageId).length,
    blocks: blocks.length,
    subscriptions: subscriptions.length,
    courses: courses.length,
    groups: groups.length,
    oneOff: oneOff.length,
    locationRules: locationRules.length,
    locationScopes: {
      country: locationRules.filter((row) => row.scope === "country").length,
      subject: locationRules.filter((row) => row.scope === "subject").length,
      teacher: locationRules.filter((row) => row.scope === "teacher").length,
    },
    referralCampaigns: referralCampaigns.length,
  };
}

async function loadWallet(userId: string) {
  const { byCode } = await loadEnabledCurrencies();
  const operations = await db
    .select({
      id: financeOperations.id,
      kind: financeOperations.kind,
      status: financeOperations.status,
      amountMinor: financeOperations.amountMinor,
      currencyCode: financeOperations.currencyCode,
      reference: financeOperations.reference,
      notes: financeOperations.notes,
      createdAt: financeOperations.createdAt,
      decimalPlaces: currencies.decimalPlaces,
      symbol: currencies.symbol,
    })
    .from(financeOperations)
    .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
    .where(eq(financeOperations.counterpartyUserId, userId))
    .orderBy(desc(financeOperations.createdAt))
    .limit(80);

  const pending = emptyTotals();
  const available = emptyTotals();
  const refunded = emptyTotals();

  for (const item of operations) {
    if (item.kind === "credit") {
      if (item.status === "completed") {
        addTotal(available, item.currencyCode, item.amountMinor);
      } else if (WALLET_PENDING.has(item.status)) {
        addTotal(pending, item.currencyCode, item.amountMinor);
      }
    }
    if (item.kind === "refund" && item.status === "completed") {
      addTotal(refunded, item.currencyCode, item.amountMinor);
    }
  }

  return {
    pending: formatTotals(pending, byCode),
    available: formatTotals(available, byCode),
    refunded: formatTotals(refunded, byCode),
    history: operations
      .filter((item) => item.kind === "credit" || item.kind === "refund")
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        status: item.status,
        amountLabel: moneyLabel(item),
        currencyCode: item.currencyCode,
        reference: item.reference,
        notes: item.notes,
        createdAt: item.createdAt,
      })),
  };
}

async function loadFamilyCharges(parentUserId: string) {
  const childIds = await loadFamilyStudentIds(parentUserId);
  const [
    lessonRows,
    groupRows,
    courseRows,
    packageRows,
    subscriptionRows,
    oneOffRows,
  ] = await Promise.all([
      db
        .select({
          id: bookings.id,
          kind: bookings.kind,
          status: bookings.status,
          amountMinor: bookings.amountMinor,
          currencyCode: bookings.currencyCode,
          packageId: bookings.packageId,
          startsAt: bookings.startsAt,
          createdAt: bookings.createdAt,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
        })
        .from(bookings)
        .innerJoin(currencies, eq(bookings.currencyCode, currencies.code))
        .where(eq(bookings.bookedByUserId, parentUserId))
        .orderBy(desc(bookings.createdAt))
        .limit(40),
      db
        .select({
          id: groupLessonEnrollments.id,
          status: groupLessonEnrollments.status,
          amountMinor: groupLessonEnrollments.amountMinor,
          currencyCode: groupLessonEnrollments.currencyCode,
          createdAt: groupLessonEnrollments.createdAt,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
        })
        .from(groupLessonEnrollments)
        .innerJoin(groupLessons, eq(groupLessons.id, groupLessonEnrollments.groupLessonId))
        .innerJoin(
          currencies,
          eq(groupLessonEnrollments.currencyCode, currencies.code),
        )
        .where(
          and(
            eq(groupLessonEnrollments.bookedByUserId, parentUserId),
            isNull(groupLessons.liveCourseId),
          ),
        )
        .orderBy(desc(groupLessonEnrollments.createdAt))
        .limit(40),
      db
        .select({
          id: liveCourseEnrollments.id,
          status: liveCourseEnrollments.status,
          amountMinor: liveCourseEnrollments.amountMinor,
          currencyCode: liveCourseEnrollments.currencyCode,
          createdAt: liveCourseEnrollments.createdAt,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
        })
        .from(liveCourseEnrollments)
        .innerJoin(
          currencies,
          eq(liveCourseEnrollments.currencyCode, currencies.code),
        )
        .where(eq(liveCourseEnrollments.bookedByUserId, parentUserId))
        .orderBy(desc(liveCourseEnrollments.createdAt))
        .limit(40),
      db
        .select({
          id: bookingPackages.id,
          status: bookingPackages.status,
          amountMinor: bookingPackages.totalAmountMinor,
          currencyCode: bookingPackages.currencyCode,
          createdAt: bookingPackages.createdAt,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
        })
        .from(bookingPackages)
        .innerJoin(currencies, eq(bookingPackages.currencyCode, currencies.code))
        .where(eq(bookingPackages.bookedByUserId, parentUserId))
        .orderBy(desc(bookingPackages.createdAt))
        .limit(20),
      childIds.length
        ? db
            .select({
              id: librarySubscriptions.id,
              status: librarySubscriptions.status,
              planKey: librarySubscriptions.planKey,
              amountMinor: librarySubscriptions.amountMinor,
              currencyCode: librarySubscriptions.currencyCode,
              createdAt: librarySubscriptions.createdAt,
              decimalPlaces: currencies.decimalPlaces,
              symbol: currencies.symbol,
            })
            .from(librarySubscriptions)
            .leftJoin(
              currencies,
              eq(librarySubscriptions.currencyCode, currencies.code),
            )
            .where(inArray(librarySubscriptions.studentUserId, childIds))
            .orderBy(desc(librarySubscriptions.createdAt))
            .limit(20)
        : Promise.resolve([]),
      db
        .select({
          id: financeOperations.id,
          status: financeOperations.status,
          amountMinor: financeOperations.amountMinor,
          currencyCode: financeOperations.currencyCode,
          createdAt: financeOperations.createdAt,
          decimalPlaces: currencies.decimalPlaces,
          symbol: currencies.symbol,
        })
        .from(financeOperations)
        .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
        .where(
          and(
            eq(financeOperations.kind, "payment"),
            eq(financeOperations.counterpartyUserId, parentUserId),
          ),
        )
        .orderBy(desc(financeOperations.createdAt))
        .limit(20),
    ]);

  return {
    hourly: lessonRows.filter((row) => !row.packageId).length,
    blocks: packageRows.length,
    courses: courseRows.length,
    groups: groupRows.length,
    subscriptions: subscriptionRows.length,
    oneOff: oneOffRows.length,
    charges: [
      ...lessonRows
        .filter((row) => !row.packageId)
        .map((row) => ({
          id: row.id,
          source: "single" as const,
          status: row.status,
          amountLabel: moneyLabel(row),
          currencyCode: row.currencyCode,
          createdAt: row.createdAt,
        })),
      ...groupRows.map((row) => ({
        id: row.id,
        source: "group" as const,
        status: row.status,
        amountLabel: moneyLabel(row),
        currencyCode: row.currencyCode,
        createdAt: row.createdAt,
      })),
      ...courseRows.map((row) => ({
        id: row.id,
        source: "course" as const,
        status: row.status,
        amountLabel: moneyLabel(row),
        currencyCode: row.currencyCode,
        createdAt: row.createdAt,
      })),
      ...packageRows.map((row) => ({
        id: row.id,
        source: "block" as const,
        status: row.status,
        amountLabel: moneyLabel(row),
        currencyCode: row.currencyCode,
        createdAt: row.createdAt,
      })),
      ...subscriptionRows.map((row) => ({
        id: row.id,
        source: "subscription" as const,
        status: row.status,
        amountLabel:
          row.amountMinor > 0 && row.decimalPlaces != null && row.symbol
            ? moneyLabel({
                amountMinor: row.amountMinor,
                decimalPlaces: row.decimalPlaces,
                symbol: row.symbol,
              })
            : row.planKey,
        currencyCode: row.currencyCode ?? "",
        createdAt: row.createdAt,
      })),
      ...oneOffRows.map((row) => ({
        id: row.id,
        source: "one-off" as const,
        status: row.status,
        amountLabel: moneyLabel(row),
        currencyCode: row.currencyCode,
        createdAt: row.createdAt,
      })),
    ]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 40),
  };
}

async function loadTeacherEarnings(teacherUserId: string) {
  const [{ byCode }, limits] = await Promise.all([
    loadEnabledCurrencies(),
    getTeacherRateLimits(),
  ]);
  const [lessonRows, groupRows, courseRows, payoutRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        amountMinor: bookings.amountMinor,
        currencyCode: bookings.currencyCode,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        packageId: bookings.packageId,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(bookings)
      .innerJoin(currencies, eq(bookings.currencyCode, currencies.code))
      .where(
        and(
          eq(bookings.teacherUserId, teacherUserId),
          inArray(bookings.status, ["confirmed", "completed", "no_show"]),
        ),
      )
      .orderBy(desc(bookings.startsAt))
      .limit(80),
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
        enrollmentAmountMinor: groupLessonEnrollments.amountMinor,
        enrollmentStatus: groupLessonEnrollments.status,
      })
      .from(groupLessons)
      .innerJoin(currencies, eq(groupLessons.currencyCode, currencies.code))
      .leftJoin(
        groupLessonEnrollments,
        eq(groupLessonEnrollments.groupLessonId, groupLessons.id),
      )
      .where(
        and(
          eq(groupLessons.teacherUserId, teacherUserId),
          inArray(groupLessons.status, ["published", "completed"]),
        ),
      ),
    db
      .select({
        id: liveCourseEnrollments.id,
        status: liveCourseEnrollments.status,
        amountMinor: liveCourseEnrollments.amountMinor,
        currencyCode: liveCourseEnrollments.currencyCode,
        createdAt: liveCourseEnrollments.createdAt,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(liveCourseEnrollments)
      .innerJoin(liveCourses, eq(liveCourseEnrollments.liveCourseId, liveCourses.id))
      .innerJoin(currencies, eq(liveCourseEnrollments.currencyCode, currencies.code))
      .where(
        and(
          eq(liveCourses.teacherUserId, teacherUserId),
          inArray(liveCourseEnrollments.status, ["confirmed", "completed"]),
        ),
      )
      .orderBy(desc(liveCourseEnrollments.createdAt))
      .limit(40),
    db
      .select({
        id: financeOperations.id,
        status: financeOperations.status,
        amountMinor: financeOperations.amountMinor,
        currencyCode: financeOperations.currencyCode,
        reference: financeOperations.reference,
        notes: financeOperations.notes,
        createdAt: financeOperations.createdAt,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(financeOperations)
      .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
      .where(
        and(
          eq(financeOperations.kind, "payout"),
          or(
            eq(financeOperations.counterpartyUserId, teacherUserId),
            eq(financeOperations.createdByUserId, teacherUserId),
          ),
        ),
      )
      .orderBy(desc(financeOperations.createdAt))
      .limit(40),
  ]);

  const gross = emptyTotals();
  const commission = emptyTotals();
  const net = emptyTotals();
  const pending = emptyTotals();
  const earned = emptyTotals();

  const lines: {
    id: string;
    source: "hourly" | "block" | "group" | "course";
    status: string;
    amountLabel: string;
    netLabel: string;
    currencyCode: string;
    pending: boolean;
  }[] = [];

  for (const row of lessonRows) {
    const split = applyCommission(
      row.amountMinor,
      limits.commissionPercent,
      limits.commissionFixedMinor,
    );
    addTotal(gross, row.currencyCode, row.amountMinor);
    addTotal(commission, row.currencyCode, split.commissionMinor);
    addTotal(net, row.currencyCode, split.teacherEarnsMinor);
    const isPending = OPEN_BOOKING.has(row.status);
    addTotal(
      isPending ? pending : earned,
      row.currencyCode,
      split.teacherEarnsMinor,
    );
    if (EARNED_BOOKING.has(row.status) || OPEN_BOOKING.has(row.status)) {
      lines.push({
        id: row.id,
        source: row.packageId ? "block" : "hourly",
        status: row.status,
        amountLabel: moneyLabel(row),
        netLabel: formatMinorAmount(
          split.teacherEarnsMinor,
          row.decimalPlaces,
          row.symbol,
        ),
        currencyCode: row.currencyCode,
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
      amountMinor: number;
      teacherPaymentMinor: number | null;
      currencyCode: string;
      decimalPlaces: number;
      symbol: string;
      enrollmentTotal: number;
    }
  >();
  for (const row of groupRows) {
    const current = grouped.get(row.id) ?? {
      id: row.id,
      status: row.status,
      startsAt: row.startsAt,
      amountMinor: row.amountMinor,
      teacherPaymentMinor: row.teacherPaymentMinor,
      currencyCode: row.currencyCode,
      decimalPlaces: row.decimalPlaces,
      symbol: row.symbol,
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
    const studentTotal = row.enrollmentTotal;
    const listed = row.teacherPaymentMinor;
    const split = applyCommission(
      studentTotal,
      limits.commissionPercent,
      limits.commissionFixedMinor,
    );
    const teacherEarnsMinor = listed != null ? listed : split.teacherEarnsMinor;
    const commissionMinor =
      listed != null
        ? Math.max(0, studentTotal - teacherEarnsMinor)
        : split.commissionMinor;
    const grossMinor = Math.max(studentTotal, teacherEarnsMinor);
    addTotal(gross, row.currencyCode, grossMinor);
    addTotal(commission, row.currencyCode, commissionMinor);
    addTotal(net, row.currencyCode, teacherEarnsMinor);
    const isPending = row.status === "published";
    addTotal(isPending ? pending : earned, row.currencyCode, teacherEarnsMinor);
    lines.push({
      id: row.id,
      source: "group",
      status: row.status,
      amountLabel: formatMinorAmount(
        studentTotal,
        row.decimalPlaces,
        row.symbol,
      ),
      netLabel: formatMinorAmount(
        teacherEarnsMinor,
        row.decimalPlaces,
        row.symbol,
      ),
      currencyCode: row.currencyCode,
      pending: isPending,
    });
  }

  for (const row of courseRows) {
    const split = applyCommission(
      row.amountMinor,
      limits.commissionPercent,
      limits.commissionFixedMinor,
    );
    addTotal(gross, row.currencyCode, row.amountMinor);
    addTotal(commission, row.currencyCode, split.commissionMinor);
    addTotal(net, row.currencyCode, split.teacherEarnsMinor);
    const isPending = row.status === "confirmed";
    addTotal(
      isPending ? pending : earned,
      row.currencyCode,
      split.teacherEarnsMinor,
    );
    lines.push({
      id: row.id,
      source: "course",
      status: row.status,
      amountLabel: moneyLabel(row),
      netLabel: formatMinorAmount(
        split.teacherEarnsMinor,
        row.decimalPlaces,
        row.symbol,
      ),
      currencyCode: row.currencyCode,
      pending: isPending,
    });
  }

  const paid = emptyTotals();
  const reserved = emptyTotals();
  for (const row of payoutRows) {
    if (row.status === "completed") {
      addTotal(paid, row.currencyCode, row.amountMinor);
    } else if (WALLET_PENDING.has(row.status)) {
      addTotal(reserved, row.currencyCode, row.amountMinor);
    }
  }

  const available = emptyTotals();
  for (const [code, amount] of earned) {
    available.set(
      code,
      Math.max(0, amount - (paid.get(code) ?? 0) - (reserved.get(code) ?? 0)),
    );
  }

  return {
    commissionPercent: limits.commissionPercent,
    commissionFixedMinor: limits.commissionFixedMinor,
    commissionFixedLabel: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    gross: formatTotals(gross, byCode),
    commission: formatTotals(commission, byCode),
    net: formatTotals(net, byCode),
    pending: formatTotals(pending, byCode),
    available: formatTotals(available, byCode),
    paid: formatTotals(paid, byCode),
    reserved: formatTotals(reserved, byCode),
    lines: lines.slice(0, 40),
    payouts: payoutRows.map((row) => ({
      id: row.id,
      status: row.status,
      amountLabel: moneyLabel(row),
      currencyCode: row.currencyCode,
      reference: row.reference,
      notes: row.notes,
      createdAt: row.createdAt,
    })),
  };
}

function deskRoleFor(actor: ApiActor): DeskRole {
  if (isStaffRole(actor.roleKey) || hasAnyPermission(actor, "payments.read")) {
    return "staff";
  }
  if (actor.roleKey === "teacher") {
    return "teacher";
  }
  if (actor.roleKey === "parent") {
    return "parent";
  }
  throw new ApiError(403, "FORBIDDEN", "Payments are not available for this account");
}

export async function getPaymentsFinanceDesk(actor: ApiActor) {
  const role = deskRoleFor(actor);
  const adapters = listPaymentsAdapters();
  const [
    limits,
    currenciesState,
    catalogue,
    currenciesFaculty,
    locationPrices,
    hourlyLessons,
    singlePayments,
    blockBookings,
    monthlySubscriptions,
    oneOffPayments,
    coursePayments,
    groupClassPayments,
    customerWallet,
    creditHistory,
    commissionAuto,
    commissionRules,
    commissionScoped,
    earningsBoard,
    settlement,
    offers,
    communications,
    notices,
    safeguard,
    crm,
    mobile,
    security,
    infrastructure,
    testing,
  ] = await Promise.all([
    getTeacherRateLimits(),
    loadEnabledCurrencies(),
    loadCatalogueCounts(),
    getCurrenciesFaculty(),
    getLocationPriceFaculty(),
    getHourlyLessonsFaculty(actor),
    getSinglePaymentsFaculty(actor),
    getBlockBookingsFaculty(actor),
    getMonthlySubscriptionsFaculty(actor),
    getOneOffPaymentsFaculty(actor),
    getCoursePaymentsFaculty(actor),
    getGroupClassPaymentsFaculty(actor),
    getCustomerWalletFaculty(actor),
    getCreditHistoryFaculty(actor),
    getCommissionAutoFaculty(actor),
    getCommissionRulesFaculty(actor),
    getCommissionScopedFaculty(actor),
    getEarningsFaculties(actor),
    getSettlementFaculties(actor),
    getOfferFaculties(actor),
    getCommunicationsFaculty(actor),
    getNoticeFaculties(actor),
    getSafeguardFaculties(actor),
    getCrmFaculties(actor),
    getMobileFaculties(actor),
    getSecurityFaculties(actor),
    getInfrastructureFaculties(actor),
    getTestingFaculties(),
  ]);

  const modules = listPaymentsModules()
    .filter((item) => role === "staff" || !item.hidesTeacherPayment || item.layer !== "earnings")
    .filter((item) => {
      if (role === "parent") {
        return (
          item.hidesTeacherPayment ||
          item.layer === "catalogue" ||
          item.layer === "wallet" ||
          item.layer === "platform" ||
          item.id === "refunds" ||
          item.id === "promo" ||
          item.id === "referral"
        );
      }
      if (role === "teacher") {
        return item.layer !== "wallet" || item.id === "account_credit";
      }
      return true;
    })
    .map((item) => ({
      id: item.id,
      layer: item.layer,
      live: item.live,
      independent: item.independent,
      href:
        item.id === "hourly" || item.id === "single" || item.id === "blocks"
          ? role === "staff"
            ? "/staff/bookings"
            : role === "teacher"
              ? "/teach/bookings"
              : "/family/bookings"
          : item.id === "subscriptions"
            ? role === "staff"
              ? "/staff/academic"
              : role === "teacher"
                ? "/teach/library"
                : "/family/library"
            : item.id === "one_off"
              ? role === "staff"
                ? "/staff/accounts"
                : role === "teacher"
                  ? "/teach/earnings"
                  : "/family/wallet"
              : item.id === "courses"
                ? role === "teacher"
                  ? "/teach/live-courses"
                  : "/live-courses"
                : item.id === "groups"
                  ? role === "staff"
                    ? "/staff/group-classes"
                    : role === "teacher"
                      ? "/teach/group-lessons"
                      : "/group-lessons"
                  : item.id === "wallet" || item.id === "credit_history"
                    ? role === "staff"
                      ? "/staff/accounts"
                      : role === "teacher"
                        ? null
                        : "/family/wallet"
                    : item.id === "commission_auto" ||
                        item.id === "commission_rules" ||
                        item.id === "commission_scoped"
                      ? role === "staff"
                        ? "/staff/rates"
                        : role === "teacher"
                          ? "/teach/earnings"
                          : null
                      : item.id === "earnings" ||
                          item.id === "earnings_split" ||
                          item.id === "payouts" ||
                          item.id === "payouts_auto"
                        ? role === "staff"
                          ? "/staff/accounts"
                          : role === "teacher"
                            ? "/teach/earnings"
                            : null
                        : item.id === "refunds" || item.id === "account_credit"
                          ? role === "staff"
                            ? "/staff/accounts"
                            : role === "parent"
                              ? "/family/wallet"
                              : null
                          : item.id === "disputes"
                            ? role === "staff"
                              ? "/staff/accounts"
                              : role === "teacher"
                                ? "/teach/earnings"
                                : null
                            : item.id === "promo" || item.id === "referral"
                              ? role === "staff"
                                ? "/staff/marketing"
                                : null
                              : role === "staff"
                        ? item.staffHref ?? null
                        : null,
    }));

  const commission = {
    percent: limits.commissionPercent,
    fixedMinor: limits.commissionFixedMinor,
    fixedLabel: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
  };

  const base = {
    role,
    adapters,
    modules,
    currencies: currenciesState.rows,
    currenciesFaculty,
    locationPrices,
    hourlyLessons,
    singlePayments,
    blockBookings,
    monthlySubscriptions,
    oneOffPayments,
    coursePayments,
    groupClassPayments,
    customerWallet,
    creditHistory,
    commissionAuto,
    commissionRules,
    commissionScoped,
    earningsBoard,
    settlement,
    offers,
    communications,
    notices,
    safeguard,
    crm,
    mobile,
    security,
    infrastructure,
    testing,
    catalogue,
    commission,
  };

  if (role === "staff") {
    if (!hasAnyPermission(actor, "payments.read")) {
      throw new ApiError(403, "FORBIDDEN", "You cannot open the payments desk");
    }
    const workspace = await listFinanceWorkspace();
    const disputes = workspace.operations.filter((item) => item.status === "on_hold");
    return {
      ...base,
      documentation: getDocumentationFaculties(),
      handover: await getHandoverFaculties(),
      workspace,
      disputes,
      wallet: null,
      familyCharges: null,
      earnings: null,
      canRefund: hasAnyPermission(actor, "payments.refund"),
      canPayout: hasAnyPermission(actor, "payouts.manage"),
      canReport: hasAnyPermission(actor, "reports.finance"),
    };
  }

  if (role === "teacher") {
    return {
      ...base,
      workspace: null,
      disputes: null,
      wallet: null,
      familyCharges: null,
      earnings: await loadTeacherEarnings(actor.userId),
      canRefund: false,
      canPayout: true,
      canReport: false,
    };
  }

  const [wallet, familyCharges] = await Promise.all([
    loadWallet(actor.userId),
    loadFamilyCharges(actor.userId),
  ]);

  return {
    ...base,
    workspace: null,
    disputes: null,
    wallet,
    familyCharges,
    earnings: null,
    canRefund: false,
    canPayout: false,
    canReport: false,
  };
}

export async function requestTeacherPayout(
  actor: ApiActor,
  input: RequestTeacherPayoutInput,
  ip: string,
) {
  if (actor.roleKey !== "teacher") {
    throw new ApiError(403, "FORBIDDEN", "Only teachers can request a payout");
  }

  const [currency] = await db
    .select()
    .from(currencies)
    .where(eq(currencies.code, input.currencyCode.toUpperCase()))
    .limit(1);
  if (!currency?.isEnabled) {
    throw new ApiError(404, "NOT_FOUND", "Currency is not available");
  }

  const amountMinor = parseMajorAmount(input.amount, currency.decimalPlaces);
  const earnings = await loadTeacherEarnings(actor.userId);
  const available =
    earnings.available.find((item) => item.currencyCode === currency.code)
      ?.amountMinor ?? 0;
  if (amountMinor > available) {
    throw new ApiError(
      422,
      "VALIDATION",
      "That payout is higher than the available balance",
    );
  }

  const [created] = await db
    .insert(financeOperations)
    .values({
      kind: "payout",
      status: "in_review",
      amountMinor,
      currencyCode: currency.code,
      counterpartyUserId: actor.userId,
      reference: `teacher-payout:${actor.userId}`,
      notes: input.notes?.trim() || "Teacher payout request",
      createdByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not record the payout request");
  }

  await writeAuditLog({
    actor,
    action: "finance.payout_requested",
    entityType: "finance_operation",
    entityId: created.id,
    ipAddress: ip,
    metadata: { amountMinor, currencyCode: currency.code },
  });

  return getPaymentsFinanceDesk(actor);
}

export { permissionForFinanceKind };
