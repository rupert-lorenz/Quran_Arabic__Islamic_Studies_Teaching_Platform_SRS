import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { currencies, financeOperations, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";
import { formatMinorAmount } from "@/server/staff/money";

const KINDS = ["credit", "refund"] as const;
const PENDING = new Set(["open", "in_review", "approved"]);

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  return eq(financeOperations.counterpartyUserId, actor.userId);
}

function historyWhere(scope: SQL | undefined) {
  const kinds = inArray(financeOperations.kind, [...KINDS]);
  return scope ? and(kinds, scope) : kinds;
}

function emptyFaculty(money: Awaited<ReturnType<typeof getRequestMoney>>) {
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
    counts: {
      entries: 0,
      credits: 0,
      refunds: 0,
      pending: 0,
    },
    totals: {
      creditsFormatted: zero,
      refundsFormatted: zero,
      pendingFormatted: zero,
    },
    recent: [] as Array<{
      id: string;
      kind: "credit" | "refund";
      source: "cancellation" | "award" | "refund";
      status: string;
      reference: string | null;
      notes: string | null;
      counterpartyName: string | null;
      createdAt: string;
      amountFormatted: string;
      listedPriceFormatted: string | null;
    }>,
  };
}

function convertedMinor(
  money: Awaited<ReturnType<typeof getRequestMoney>>,
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
  }).studentPriceMinor;
}

function sourceOf(kind: "credit" | "refund", reference: string | null) {
  if (kind === "refund") {
    return "refund" as const;
  }
  return reference?.startsWith("booking:")
    ? ("cancellation" as const)
    : ("award" as const);
}

export async function getCreditHistoryFaculty(actor: ApiActor) {
  const money = await getRequestMoney();
  if (actor.roleKey === "teacher") {
    return emptyFaculty(money);
  }
  const scope = scopeFor(actor);
  const counted = historyWhere(scope);
  const [rows, recentRows] = await Promise.all([
    db
      .select({
        kind: financeOperations.kind,
        status: financeOperations.status,
        amountMinor: financeOperations.amountMinor,
        currencyCode: financeOperations.currencyCode,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(financeOperations)
      .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
      .where(counted),
    db
      .select({
        id: financeOperations.id,
        kind: financeOperations.kind,
        status: financeOperations.status,
        amountMinor: financeOperations.amountMinor,
        currencyCode: financeOperations.currencyCode,
        reference: financeOperations.reference,
        notes: financeOperations.notes,
        createdAt: financeOperations.createdAt,
        counterpartyName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(financeOperations)
      .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
      .leftJoin(users, eq(users.id, financeOperations.counterpartyUserId))
      .where(counted)
      .orderBy(desc(financeOperations.createdAt))
      .limit(20),
  ]);

  let creditsMinor = 0;
  let refundsMinor = 0;
  let pendingMinor = 0;
  let credits = 0;
  let refunds = 0;
  let pending = 0;
  for (const row of rows) {
    const minor = convertedMinor(money, row);
    if (row.kind === "credit") {
      credits += 1;
      creditsMinor += minor;
    } else if (row.kind === "refund") {
      refunds += 1;
      refundsMinor += minor;
    }
    if (PENDING.has(row.status)) {
      pending += 1;
      pendingMinor += minor;
    }
  }

  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));

  return {
    display: money.currency,
    conversionActive,
    counts: {
      entries: rows.length,
      credits,
      refunds,
      pending,
    },
    totals: {
      creditsFormatted: formatMinorAmount(
        creditsMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
      refundsFormatted: formatMinorAmount(
        refundsMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
      pendingFormatted: formatMinorAmount(
        pendingMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
    },
    recent: recentRows.flatMap((row) => {
      if (row.kind !== "credit" && row.kind !== "refund") {
        return [];
      }
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
      return [
        {
          id: row.id,
          kind: row.kind,
          source: sourceOf(row.kind, row.reference),
          status: row.status,
          reference: row.reference,
          notes: row.notes,
          counterpartyName: row.counterpartyName,
          createdAt: row.createdAt.toISOString(),
          amountFormatted: price.studentPriceFormatted,
          listedPriceFormatted: price.listedPriceFormatted,
        },
      ];
    }),
  };
}
