import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { currencies, fxRates, platformSettings } from "@/db/schema";
import { DEFAULT_CURRENCY, FX_RATE_SCALE, formatFxMajorRate } from "@/lib/currency";
import { ensureSeedCurrencies, getCurrenciesFaculty } from "@/server/money/currency";
import { normalizeCurrencyCode } from "@/lib/geo";
import { hasAnyPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { parseStaffFxRate } from "@/server/money/currency";
import type { UpdateCurrencyInput, UpsertFxRateInput } from "./schemas";

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadDefaultCurrencyCode() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "platform.default_currency"))
    .limit(1);
  return normalizeCurrencyCode(settingString(row?.value)) ?? DEFAULT_CURRENCY;
}

async function countEnabledCurrencies() {
  const [row] = await db
    .select({ value: count() })
    .from(currencies)
    .where(eq(currencies.isEnabled, true));
  return Number(row?.value ?? 0);
}

export async function listCurrencyWorkspace(actor: ApiActor) {
  if (!hasAnyPermission(actor, ["settings.write", "payments.read"])) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage currencies");
  }

  await ensureSeedCurrencies();
  const [currencyRows, rateRows, defaultCode, enabledCount, faculty] = await Promise.all([
    db
      .select({
        code: currencies.code,
        name: currencies.name,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
        isEnabled: currencies.isEnabled,
      })
      .from(currencies)
      .orderBy(currencies.code),
    db
      .select({
        quoteCode: fxRates.quoteCode,
        rateInteger: fxRates.rateInteger,
        asOf: fxRates.asOf,
      })
      .from(fxRates)
      .where(eq(fxRates.baseCode, await loadDefaultCurrencyCode())),
    loadDefaultCurrencyCode(),
    countEnabledCurrencies(),
    getCurrenciesFaculty(),
  ]);

  const rateByQuote = new Map(rateRows.map((row) => [row.quoteCode, row]));

  return {
    defaultCurrency: defaultCode,
    canManage: hasAnyPermission(actor, "settings.write"),
    faculty,
    summary: {
      currencies: currencyRows.length,
      enabled: enabledCount,
      rates: rateRows.length,
    },
    currencies: currencyRows.map((row) => {
      const rate = rateByQuote.get(row.code);
      const rateInteger =
        row.code === defaultCode ? 10 ** FX_RATE_SCALE : (rate?.rateInteger ?? null);
      return {
        ...row,
        isDefault: row.code === defaultCode,
        hasRate: rateInteger != null,
        rateInteger,
        rate: rateInteger == null ? "" : formatFxMajorRate(rateInteger),
        asOf: rate?.asOf?.toISOString() ?? null,
      };
    }),
  };
}

export async function updateCurrency(
  actor: ApiActor,
  codeValue: string,
  input: UpdateCurrencyInput,
  ip: string,
) {
  if (!hasAnyPermission(actor, "settings.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change currencies");
  }

  const code = normalizeCurrencyCode(codeValue);
  if (!code) {
    throw new ApiError(400, "VALIDATION", "Currency code is required");
  }

  const [current] = await db
    .select({
      code: currencies.code,
      isEnabled: currencies.isEnabled,
    })
    .from(currencies)
    .where(eq(currencies.code, code))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Currency not found");
  }

  if (input.isEnabled === false && current.isEnabled) {
    const defaultCode = await loadDefaultCurrencyCode();
    if (current.code === defaultCode) {
      throw new ApiError(
        422,
        "VALIDATION",
        "Keep the platform default currency available",
      );
    }
    if ((await countEnabledCurrencies()) <= 1) {
      throw new ApiError(422, "VALIDATION", "Keep at least one currency available");
    }
  }

  await db
    .update(currencies)
    .set({ isEnabled: input.isEnabled })
    .where(eq(currencies.code, current.code));

  await writeAuditLog({
    actor,
    action: "settings.currency_updated",
    entityType: "currency",
    entityId: current.code,
    ipAddress: ip,
    metadata: { isEnabled: input.isEnabled },
  });

  return listCurrencyWorkspace(actor);
}

export async function upsertFxRate(
  actor: ApiActor,
  input: UpsertFxRateInput,
  ip: string,
) {
  if (!hasAnyPermission(actor, "settings.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change exchange rates");
  }

  const quoteCode = normalizeCurrencyCode(input.quoteCode);
  if (!quoteCode) {
    throw new ApiError(422, "VALIDATION", "Choose a valid currency");
  }

  const defaultCode = await loadDefaultCurrencyCode();
  if (quoteCode === defaultCode) {
    throw new ApiError(422, "VALIDATION", "The default currency rate is always 1");
  }

  const [quote] = await db
    .select({ code: currencies.code, isEnabled: currencies.isEnabled })
    .from(currencies)
    .where(eq(currencies.code, quoteCode))
    .limit(1);
  if (!quote) {
    throw new ApiError(404, "NOT_FOUND", "Currency not found");
  }

  const rateInteger = parseStaffFxRate(input.rate);
  await db
    .insert(fxRates)
    .values({
      baseCode: defaultCode,
      quoteCode,
      rateInteger,
      rateScale: FX_RATE_SCALE,
      asOf: new Date(),
    })
    .onConflictDoUpdate({
      target: [fxRates.baseCode, fxRates.quoteCode],
      set: {
        rateInteger,
        rateScale: FX_RATE_SCALE,
        asOf: new Date(),
      },
    });

  await writeAuditLog({
    actor,
    action: "settings.fx_rate_updated",
    entityType: "fx_rate",
    entityId: `${defaultCode}-${quoteCode}`,
    ipAddress: ip,
    metadata: { rateInteger },
  });

  return listCurrencyWorkspace(actor);
}
