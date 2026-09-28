import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { seedCurrencies } from "@/db/seed-data";
import { countries, currencies, fxRates, platformSettings, users } from "@/db/schema";
import {
  CURRENCY_COOKIE_NAME,
  DEFAULT_CURRENCY,
  FX_RATE_SCALE,
  convertMinorAmount,
  formatFxMajorRate,
  localizeTeacherRate,
  parseFxMajorRate,
  resolveCurrencyCode,
  seedFxRatesAgainstGbp,
  type FxBook,
  type PublicCurrency,
} from "@/lib/currency";
import { normalizeCurrencyCode } from "@/lib/geo";
import type { TeacherRateView } from "@/lib/teacher-rate-display";
import { getServerUser } from "@/server/auth/session";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";

const fallbackCurrency: PublicCurrency = {
  code: DEFAULT_CURRENCY,
  name: "British Pound",
  symbol: "£",
  decimalPlaces: 2,
  isDefault: true,
};

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const COUNTRY_CURRENCY_DEFAULTS: Record<string, string> = {
  JO: "JOD",
  MA: "MAD",
  QA: "QAR",
  KW: "KWD",
};

export const ensureSeedCurrencies = cache(async () => {
  await db.insert(currencies).values([...seedCurrencies]).onConflictDoNothing();
  const fxRows = seedFxRatesAgainstGbp.flatMap((row) => {
    const rateInteger = parseFxMajorRate(row.rate);
    return rateInteger == null
      ? []
      : [
          {
            baseCode: DEFAULT_CURRENCY,
            quoteCode: row.quoteCode,
            rateInteger,
            rateScale: FX_RATE_SCALE,
          },
        ];
  });
  if (fxRows.length > 0) {
    await db.insert(fxRates).values(fxRows).onConflictDoNothing();
  }
  for (const [iso2, defaultCurrencyCode] of Object.entries(COUNTRY_CURRENCY_DEFAULTS)) {
    await db
      .update(countries)
      .set({ defaultCurrencyCode })
      .where(eq(countries.iso2, iso2));
  }
});

async function loadCurrencyRows() {
  await ensureSeedCurrencies();
  return db
    .select({
      code: currencies.code,
      name: currencies.name,
      symbol: currencies.symbol,
      decimalPlaces: currencies.decimalPlaces,
      isEnabled: currencies.isEnabled,
    })
    .from(currencies)
    .orderBy(currencies.code);
}

async function loadDefaultCurrencyCode() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "platform.default_currency"))
    .limit(1);
  return normalizeCurrencyCode(settingString(row?.value)) ?? DEFAULT_CURRENCY;
}

async function loadCountryCurrency(iso2?: string | null) {
  const code = iso2?.trim().toUpperCase();
  if (!code) {
    return null;
  }
  const [row] = await db
    .select({ defaultCurrencyCode: countries.defaultCurrencyCode })
    .from(countries)
    .where(eq(countries.iso2, code))
    .limit(1);
  return row?.defaultCurrencyCode ?? null;
}

async function loadFxBook(baseCode: string): Promise<FxBook> {
  const rows = await db
    .select({
      quoteCode: fxRates.quoteCode,
      rateInteger: fxRates.rateInteger,
    })
    .from(fxRates)
    .where(eq(fxRates.baseCode, baseCode));
  return {
    baseCode,
    rates: new Map(rows.map((row) => [row.quoteCode, row.rateInteger])),
  };
}

export const getRequestMoney = cache(async () => {
  try {
    const [rows, defaultCode, store, user] = await Promise.all([
      loadCurrencyRows(),
      loadDefaultCurrencyCode(),
      cookies(),
      getServerUser(),
    ]);
    const enabled = rows.filter((row) => row.isEnabled);
    const countryCurrency = await loadCountryCurrency(user?.country).catch(() => null);
    const cookieCode = normalizeCurrencyCode(store.get(CURRENCY_COOKIE_NAME)?.value);
    const accountCode = normalizeCurrencyCode(user?.currency);
    const countryCode = normalizeCurrencyCode(countryCurrency);
    const enabledCodes = enabled.map((row) => row.code);
    const code = resolveCurrencyCode({
      cookie: cookieCode,
      userCurrency: accountCode,
      countryCurrency: countryCode,
      defaultCode,
      enabled: enabledCodes,
    });
    const marketSource =
      cookieCode && enabledCodes.includes(cookieCode)
        ? ("cookie" as const)
        : accountCode && enabledCodes.includes(accountCode)
          ? ("account" as const)
          : countryCode && enabledCodes.includes(countryCode)
            ? ("country" as const)
            : ("default" as const);
    const row = enabled.find((item) => item.code === code) ?? enabled[0];
    const currency: PublicCurrency = row
      ? {
          code: row.code,
          name: row.name,
          symbol: row.symbol,
          decimalPlaces: row.decimalPlaces,
          isDefault: row.code === defaultCode,
        }
      : fallbackCurrency;
    const currenciesList = enabled.map((item) => ({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      decimalPlaces: item.decimalPlaces,
      isDefault: item.code === defaultCode,
    })) satisfies PublicCurrency[];
    const book = await loadFxBook(defaultCode);

    return {
      currency,
      currencies: currenciesList,
      defaultCode,
      marketSource,
      country: user?.country
        ? { iso2: user.country, currencyCode: countryCode }
        : null,
      book,
      convert: (
        amountMinor: number,
        from: { code: string; decimalPlaces: number },
        to: { code: string; decimalPlaces: number } = currency,
      ) =>
        convertMinorAmount({
          amountMinor,
          from,
          to,
          book,
        }),
      presentRate: (
        rate: Parameters<typeof localizeTeacherRate>[0],
        listing: Parameters<typeof localizeTeacherRate>[1],
      ): TeacherRateView | null => localizeTeacherRate(rate, listing, currency, book),
    };
  } catch {
    return {
      currency: fallbackCurrency,
      currencies: [fallbackCurrency],
      defaultCode: DEFAULT_CURRENCY,
      marketSource: "default" as const,
      country: null,
      book: { baseCode: DEFAULT_CURRENCY, rates: new Map() },
      convert: (amountMinor: number, from: { code: string }, to?: { code: string }) =>
        from.code === (to?.code ?? fallbackCurrency.code) ? amountMinor : null,
      presentRate: (
        rate: Parameters<typeof localizeTeacherRate>[0],
        listing: Parameters<typeof localizeTeacherRate>[1],
      ): TeacherRateView | null =>
        localizeTeacherRate(rate, listing, fallbackCurrency, {
          baseCode: DEFAULT_CURRENCY,
          rates: new Map(),
        }),
    };
  }
});

export async function setPreferredCurrency(code: string, actor: ApiActor | null) {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized) {
    throw new ApiError(422, "VALIDATION", "Choose a valid currency");
  }

  const [row] = await db
    .select({
      code: currencies.code,
      name: currencies.name,
      symbol: currencies.symbol,
      decimalPlaces: currencies.decimalPlaces,
      isEnabled: currencies.isEnabled,
    })
    .from(currencies)
    .where(eq(currencies.code, normalized))
    .limit(1);

  if (!row?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "That currency is not available");
  }

  if (actor) {
    await db
      .update(users)
      .set({ currency: row.code })
      .where(eq(users.id, actor.userId));
  }

  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    decimalPlaces: row.decimalPlaces,
  };
}

export async function convertToPlatformMinor(
  amountMinor: number,
  from: { code: string; decimalPlaces: number },
) {
  const { defaultCode, currencies: enabled, book, convert } = await getRequestMoney();
  const platform =
    enabled.find((item) => item.code === defaultCode) ?? enabled[0] ?? fallbackCurrency;
  const converted = convert(amountMinor, from, platform);
  if (converted == null) {
    throw new ApiError(
      422,
      "VALIDATION",
      `No exchange rate from ${from.code} to ${platform.code}. Staff need to set FX rates.`,
    );
  }
  return { amountMinor: converted, currency: platform, book };
}

export function fxRateRows(book: FxBook, quotes: PublicCurrency[]) {
  return quotes.map((quote) => {
    const rateInteger =
      quote.code === book.baseCode
        ? 10 ** FX_RATE_SCALE
        : (book.rates.get(quote.code) ?? null);
    return {
      quoteCode: quote.code,
      name: quote.name,
      symbol: quote.symbol,
      rateInteger,
      rate: rateInteger == null ? "" : formatFxMajorRate(rateInteger),
    };
  });
}

export async function getCurrenciesFaculty() {
  const money = await getRequestMoney();
  const rows = await loadCurrencyRows();
  const missingRates = money.currencies.filter(
    (item) =>
      item.code !== money.defaultCode && !money.book.rates.has(item.code),
  );
  return {
    display: money.currency,
    defaultCode: money.defaultCode,
    enabled: money.currencies,
    catalogue: rows.map((row) => ({
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimalPlaces: row.decimalPlaces,
      isEnabled: row.isEnabled,
      isDefault: row.code === money.defaultCode,
      hasRate:
        row.code === money.defaultCode || money.book.rates.has(row.code),
    })),
    missingRates,
    enabledCount: money.currencies.length,
    catalogueCount: rows.length,
  };
}

export function parseStaffFxRate(value: string) {
  const rateInteger = parseFxMajorRate(value);
  if (rateInteger == null) {
    throw new ApiError(422, "VALIDATION", "Enter a valid exchange rate greater than zero");
  }
  return rateInteger;
}
