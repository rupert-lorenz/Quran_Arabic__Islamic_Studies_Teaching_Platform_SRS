import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { currencies, financeOperations, users } from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";
import { listPaymentsAdapters } from "@/server/finance/adapter";

const OPEN = ["open", "in_review", "approved"] as const;

function scopeFor(actor: ApiActor): SQL | undefined {
  if (isStaffRole(actor.roleKey)) return undefined;
  return eq(financeOperations.counterpartyUserId, actor.userId);
}

function isPartial(notes: string | null) {
  return Boolean(notes && /\bpartial\b/i.test(notes));
}

async function recentKind(actor: ApiActor, kind: "refund" | "credit" | "payout") {
  const money = await getRequestMoney();
  const scope = scopeFor(actor);
  const where = scope
    ? and(eq(financeOperations.kind, kind), scope)
    : eq(financeOperations.kind, kind);
  const rows = await db
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
    .where(where)
    .orderBy(desc(financeOperations.createdAt))
    .limit(80);
  return { money, rows };
}

function presentRow(
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
  });
}

export async function getSettlementFaculties(actor: ApiActor) {
  const [refunds, credits, payouts, held] = await Promise.all([
    recentKind(actor, "refund"),
    recentKind(actor, "credit"),
    recentKind(actor, "payout"),
    db
      .select({
        id: financeOperations.id,
        kind: financeOperations.kind,
        status: financeOperations.status,
        amountMinor: financeOperations.amountMinor,
        currencyCode: financeOperations.currencyCode,
        notes: financeOperations.notes,
        createdAt: financeOperations.createdAt,
        counterpartyName: users.displayName,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(financeOperations)
      .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
      .leftJoin(users, eq(users.id, financeOperations.counterpartyUserId))
      .where(
        scopeFor(actor)
          ? and(eq(financeOperations.status, "on_hold"), scopeFor(actor))
          : eq(financeOperations.status, "on_hold"),
      )
      .orderBy(desc(financeOperations.createdAt))
      .limit(40),
  ]);

  const adapters = listPaymentsAdapters();
  const money = refunds.money;
  const mapRecent = (
    pack: typeof refunds,
    extra?: (row: (typeof refunds.rows)[number]) => string,
  ) =>
    pack.rows.slice(0, 8).map((row) => {
      const price = presentRow(money, row);
      return {
        id: row.id,
        title: extra ? extra(row) : row.status.replaceAll("_", " "),
        meta: [
          price.studentPriceFormatted,
          row.counterpartyName,
          row.notes,
          row.createdAt.toISOString().slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });

  const refundFull = refunds.rows.filter((row) => !isPartial(row.notes)).length;
  const refundPartial = refunds.rows.filter((row) => isPartial(row.notes)).length;
  const countStatus = (rows: { status: string }[], status: string) =>
    rows.filter((row) => row.status === status).length;
  const countOpen = (rows: { status: string }[]) =>
    rows.filter((row) => (OPEN as readonly string[]).includes(row.status)).length;

  return {
    refunds: {
      full: refundFull,
      partial: refundPartial,
      pending: countOpen(refunds.rows),
      completed: countStatus(refunds.rows, "completed"),
      recent: mapRecent(refunds, (row) =>
        isPartial(row.notes) ? "partial" : "full",
      ),
    },
    credits: {
      pending: countOpen(credits.rows),
      completed: countStatus(credits.rows, "completed"),
      rejected: countStatus(credits.rows, "rejected"),
      total: credits.rows.length,
      recent: mapRecent(credits),
    },
    payouts: {
      pending: countOpen(payouts.rows),
      completed: countStatus(payouts.rows, "completed"),
      held: countStatus(payouts.rows, "on_hold"),
      rejected: countStatus(payouts.rows, "rejected"),
      recent: mapRecent(payouts),
    },
    payoutsAuto: {
      configured: adapters.payouts.configured,
      provider: adapters.payouts.id,
      queued: payouts.rows.filter((row) => row.status === "in_review").length,
      recent: mapRecent({
        ...payouts,
        rows: payouts.rows.filter((row) => row.status === "in_review"),
      }),
    },
    disputes: {
      held: held.length,
      payments: held.filter((row) => row.kind === "payment").length,
      refunds: held.filter((row) => row.kind === "refund").length,
      credits: held.filter((row) => row.kind === "credit").length,
      recent: held.slice(0, 8).map((row) => {
        const price = presentRow(money, row);
        return {
          id: row.id,
          title: row.kind,
          meta: [price.studentPriceFormatted, row.counterpartyName, row.notes]
            .filter(Boolean)
            .join(" · "),
        };
      }),
    },
  };
}
