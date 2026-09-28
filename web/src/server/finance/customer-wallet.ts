import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { currencies, financeOperations, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";
import { formatMinorAmount } from "@/server/staff/money";

const PENDING = new Set(["open", "in_review", "approved"]);

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  return eq(financeOperations.counterpartyUserId, actor.userId);
}

function creditWhere(scope: SQL | undefined) {
  return scope
    ? and(eq(financeOperations.kind, "credit"), scope)
    : eq(financeOperations.kind, "credit");
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
      credits: 0,
      available: 0,
      pending: 0,
      held: 0,
    },
    totals: {
      availableFormatted: zero,
      pendingFormatted: zero,
      heldFormatted: zero,
    },
    recent: [] as Array<{
      id: string;
      source: "cancellation" | "award";
      status: string;
      reference: string | null;
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

export async function getCustomerWalletFaculty(actor: ApiActor) {
  const money = await getRequestMoney();
  if (actor.roleKey === "teacher") {
    return emptyFaculty(money);
  }
  const scope = scopeFor(actor);
  const counted = creditWhere(scope);
  const [creditRows, recentRows] = await Promise.all([
    db
      .select({
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
        status: financeOperations.status,
        amountMinor: financeOperations.amountMinor,
        currencyCode: financeOperations.currencyCode,
        reference: financeOperations.reference,
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
      .limit(8),
  ]);

  let availableMinor = 0;
  let pendingMinor = 0;
  let heldMinor = 0;
  let available = 0;
  let pending = 0;
  let held = 0;
  for (const row of creditRows) {
    const minor = convertedMinor(money, row);
    if (row.status === "completed") {
      available += 1;
      availableMinor += minor;
    } else if (PENDING.has(row.status)) {
      pending += 1;
      pendingMinor += minor;
    } else if (row.status === "on_hold") {
      held += 1;
      heldMinor += minor;
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
      credits: creditRows.length,
      available,
      pending,
      held,
    },
    totals: {
      availableFormatted: formatMinorAmount(
        availableMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
      pendingFormatted: formatMinorAmount(
        pendingMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
      heldFormatted: formatMinorAmount(
        heldMinor,
        money.currency.decimalPlaces,
        money.currency.symbol,
      ),
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
        source: row.reference?.startsWith("booking:")
          ? ("cancellation" as const)
          : ("award" as const),
        status: row.status,
        reference: row.reference,
        counterpartyName: row.counterpartyName,
        createdAt: row.createdAt.toISOString(),
        amountFormatted: price.studentPriceFormatted,
        listedPriceFormatted: price.listedPriceFormatted,
      };
    }),
  };
}
