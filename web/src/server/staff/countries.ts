import { count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { countries, currencies, users } from "@/db/schema";
import {
  normalizeCurrencyCode,
  normalizeIso2,
  normalizeIso3,
  normalizeTimezone,
  timezoneOptions,
} from "@/lib/geo";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import type { CreateCountryInput, UpdateCountryInput } from "./schemas";

async function resolveEnabledCurrency(code: string) {
  const currencyCode = normalizeCurrencyCode(code);
  if (!currencyCode) {
    throw new ApiError(422, "VALIDATION", "Use a three-letter currency code");
  }
  const [currency] = await db
    .select({
      code: currencies.code,
      name: currencies.name,
      symbol: currencies.symbol,
      isEnabled: currencies.isEnabled,
    })
    .from(currencies)
    .where(eq(currencies.code, currencyCode))
    .limit(1);
  if (!currency?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "Currency is not available");
  }
  return currency;
}

async function countEnabledCountries() {
  const [row] = await db
    .select({ value: count() })
    .from(countries)
    .where(eq(countries.isEnabled, true));
  return Number(row?.value ?? 0);
}

export async function listCountryWorkspace() {
  const [countryRows, currencyRows, userRows] = await Promise.all([
    db
      .select({
        iso2: countries.iso2,
        iso3: countries.iso3,
        name: countries.name,
        defaultTimezone: countries.defaultTimezone,
        defaultCurrencyCode: countries.defaultCurrencyCode,
        currencyName: currencies.name,
        currencySymbol: currencies.symbol,
        isEnabled: countries.isEnabled,
        sortOrder: countries.sortOrder,
      })
      .from(countries)
      .innerJoin(
        currencies,
        eq(countries.defaultCurrencyCode, currencies.code),
      )
      .orderBy(countries.sortOrder, countries.name),
    db
      .select({
        code: currencies.code,
        name: currencies.name,
        symbol: currencies.symbol,
      })
      .from(currencies)
      .where(eq(currencies.isEnabled, true))
      .orderBy(currencies.code),
    db
      .select({ country: users.country, value: count() })
      .from(users)
      .where(isNull(users.deletedAt))
      .groupBy(users.country),
  ]);

  const usersByCountry = new Map(
    userRows.map((row) => [row.country, Number(row.value)]),
  );

  return {
    summary: {
      countries: countryRows.length,
      enabled: countryRows.filter((item) => item.isEnabled).length,
      hidden: countryRows.filter((item) => !item.isEnabled).length,
    },
    countries: countryRows.map((row) => ({
      ...row,
      userCount: usersByCountry.get(row.iso2) ?? 0,
    })),
    currencies: currencyRows,
    timezones: timezoneOptions(),
  };
}

export async function createCountry(
  actor: ApiActor,
  input: CreateCountryInput,
  ip: string,
) {
  const iso2 = normalizeIso2(input.iso2);
  const iso3 = normalizeIso3(input.iso3);
  const timezone = normalizeTimezone(input.defaultTimezone);
  if (!iso2 || !iso3) {
    throw new ApiError(422, "VALIDATION", "Enter valid ISO country codes");
  }
  if (!timezone) {
    throw new ApiError(422, "VALIDATION", "Choose a valid timezone");
  }
  const currency = await resolveEnabledCurrency(input.defaultCurrencyCode);

  const [existing] = await db
    .select({ iso2: countries.iso2, iso3: countries.iso3 })
    .from(countries)
    .where(eq(countries.iso2, iso2))
    .limit(1);
  if (existing) {
    throw new ApiError(409, "CONFLICT", "A country with this code already exists");
  }

  const [iso3Taken] = await db
    .select({ iso2: countries.iso2 })
    .from(countries)
    .where(eq(countries.iso3, iso3))
    .limit(1);
  if (iso3Taken) {
    throw new ApiError(409, "CONFLICT", "That three-letter country code is already used");
  }

  const [created] = await db
    .insert(countries)
    .values({
      iso2,
      iso3,
      name: input.name.trim(),
      defaultTimezone: timezone,
      defaultCurrencyCode: currency.code,
      sortOrder: input.sortOrder ?? 100,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the country");
  }

  await writeAuditLog({
    actor,
    action: "countries.created",
    entityType: "country",
    entityId: created.iso2,
    ipAddress: ip,
  });

  return listCountryWorkspace();
}

export async function updateCountry(
  actor: ApiActor,
  iso2Value: string,
  input: UpdateCountryInput,
  ip: string,
) {
  const iso2 = normalizeIso2(iso2Value);
  if (!iso2) {
    throw new ApiError(400, "VALIDATION", "Country code is required");
  }

  const [current] = await db
    .select({
      iso2: countries.iso2,
      isEnabled: countries.isEnabled,
    })
    .from(countries)
    .where(eq(countries.iso2, iso2))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Country not found");
  }

  if (input.isEnabled === false && current.isEnabled) {
    const enabledCount = await countEnabledCountries();
    if (enabledCount <= 1) {
      throw new ApiError(
        422,
        "VALIDATION",
        "Keep at least one country available",
      );
    }
  }

  const timezone =
    input.defaultTimezone !== undefined
      ? normalizeTimezone(input.defaultTimezone)
      : undefined;
  if (input.defaultTimezone !== undefined && !timezone) {
    throw new ApiError(422, "VALIDATION", "Choose a valid timezone");
  }

  const currency =
    input.defaultCurrencyCode !== undefined
      ? await resolveEnabledCurrency(input.defaultCurrencyCode)
      : null;

  const [updated] = await db
    .update(countries)
    .set({
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(timezone ? { defaultTimezone: timezone } : {}),
      ...(currency ? { defaultCurrencyCode: currency.code } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    })
    .where(eq(countries.iso2, iso2))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Country not found");
  }

  await writeAuditLog({
    actor,
    action: "countries.updated",
    entityType: "country",
    entityId: iso2,
    ipAddress: ip,
    metadata: input,
  });

  return listCountryWorkspace();
}
