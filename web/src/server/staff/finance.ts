import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  currencies,
  financeOperations,
  platformSettings,
  users,
} from "@/db/schema";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { findOptionalUserByEmail } from "./lookup";
import { formatMinorAmount, parseMajorAmount } from "./money";
import type {
  CreateFinanceOperationInput,
  UpdateFinanceOperationInput,
} from "./schemas";

export function permissionForFinanceKind(
  kind: "payment" | "refund" | "credit" | "payout",
) {
  if (kind === "refund" || kind === "credit") {
    return "payments.refund";
  }
  if (kind === "payout") {
    return "payouts.manage";
  }
  return "payments.read";
}

export async function listFinanceWorkspace() {
  const [operations, currencyRows, commission] = await Promise.all([
    db
      .select({
        id: financeOperations.id,
        kind: financeOperations.kind,
        status: financeOperations.status,
        amountMinor: financeOperations.amountMinor,
        currencyCode: financeOperations.currencyCode,
        currencySymbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
        reference: financeOperations.reference,
        notes: financeOperations.notes,
        counterpartyEmail: users.email,
        counterpartyName: users.displayName,
        createdAt: financeOperations.createdAt,
      })
      .from(financeOperations)
      .innerJoin(currencies, eq(financeOperations.currencyCode, currencies.code))
      .leftJoin(users, eq(financeOperations.counterpartyUserId, users.id))
      .orderBy(desc(financeOperations.createdAt))
      .limit(100),
    db
      .select({
        code: currencies.code,
        name: currencies.name,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
      })
      .from(currencies)
      .where(eq(currencies.isEnabled, true)),
    db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, "commission.default_percent"))
      .limit(1),
  ]);

  const summary = {
    payments: operations.filter((item) => item.kind === "payment").length,
    refunds: operations.filter((item) => item.kind === "refund").length,
    credits: operations.filter((item) => item.kind === "credit").length,
    payouts: operations.filter((item) => item.kind === "payout").length,
    open: operations.filter((item) => item.status === "open" || item.status === "in_review")
      .length,
    commissionPercent: Number(commission[0]?.value ?? 20),
  };

  return {
    summary,
    currencies: currencyRows,
    operations: operations.map((item) => ({
      ...item,
      amountLabel: formatMinorAmount(
        item.amountMinor,
        item.decimalPlaces,
        item.currencySymbol,
      ),
    })),
  };
}

export async function createFinanceOperation(
  actor: ApiActor,
  input: CreateFinanceOperationInput,
  ip: string,
) {
  if (!hasAnyPermission(actor, permissionForFinanceKind(input.kind))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot record this finance item");
  }

  const [currency] = await db
    .select()
    .from(currencies)
    .where(eq(currencies.code, input.currencyCode.toUpperCase()))
    .limit(1);

  if (!currency?.isEnabled) {
    throw new ApiError(404, "NOT_FOUND", "Currency is not available");
  }

  const counterparty = await findOptionalUserByEmail(input.counterpartyEmail);
  const [created] = await db
    .insert(financeOperations)
    .values({
      kind: input.kind,
      amountMinor: parseMajorAmount(input.amount, currency.decimalPlaces),
      currencyCode: currency.code,
      counterpartyUserId: counterparty?.id,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      createdByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not record the finance item");
  }

  await writeAuditLog({
    actor,
    action: `finance.${input.kind}_recorded`,
    entityType: "finance_operation",
    entityId: created.id,
    ipAddress: ip,
    metadata: { kind: input.kind, amountMinor: created.amountMinor },
  });

  return created;
}

export async function updateFinanceOperation(
  actor: ApiActor,
  id: string,
  input: UpdateFinanceOperationInput,
  ip: string,
) {
  const [current] = await db
    .select()
    .from(financeOperations)
    .where(eq(financeOperations.id, id))
    .limit(1);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Finance item not found");
  }

  if (!hasAnyPermission(actor, permissionForFinanceKind(current.kind))) {
    throw new ApiError(403, "FORBIDDEN", "You cannot update this finance item");
  }

  const [updated] = await db
    .update(financeOperations)
    .set({
      status: input.status,
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
    })
    .where(eq(financeOperations.id, id))
    .returning();

  await writeAuditLog({
    actor,
    action: "finance.status_updated",
    entityType: "finance_operation",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status, kind: current.kind },
  });

  return updated;
}
