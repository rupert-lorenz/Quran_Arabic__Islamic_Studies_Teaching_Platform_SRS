import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { currencies, financeOperations, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";

const OPEN = ["open", "in_review", "approved"] as const;

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) {
    return undefined;
  }
  return eq(financeOperations.counterpartyUserId, actor.userId);
}

function paymentWhere(scope: SQL | undefined, extra?: SQL) {
  const base = scope
    ? and(eq(financeOperations.kind, "payment"), scope)
    : eq(financeOperations.kind, "payment");
  return extra ? and(base, extra) : base;
}

export async function getOneOffPaymentsFaculty(actor: ApiActor) {
  const scope = scopeFor(actor);
  const counted = paymentWhere(scope);
  const [money, payments, open, completed, held, recentRows] = await Promise.all([
    getRequestMoney(),
    db.select({ value: count() }).from(financeOperations).where(counted),
    db
      .select({ value: count() })
      .from(financeOperations)
      .where(paymentWhere(scope, inArray(financeOperations.status, [...OPEN]))),
    db
      .select({ value: count() })
      .from(financeOperations)
      .where(paymentWhere(scope, eq(financeOperations.status, "completed"))),
    db
      .select({ value: count() })
      .from(financeOperations)
      .where(paymentWhere(scope, eq(financeOperations.status, "on_hold"))),
    db
      .select({
        id: financeOperations.id,
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
      held: held[0]?.value ?? 0,
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
        status: row.status,
        reference: row.reference,
        notes: row.notes,
        counterpartyName: row.counterpartyName,
        createdAt: row.createdAt.toISOString(),
        amountFormatted: price.studentPriceFormatted,
        listedPriceFormatted: price.listedPriceFormatted,
      };
    }),
  };
}
