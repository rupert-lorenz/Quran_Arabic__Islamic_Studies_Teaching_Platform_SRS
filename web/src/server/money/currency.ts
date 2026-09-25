import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
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

async function loadCurrencyRows() {
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
    const code = resolveCurrencyCode({
      cookie: store.get(CURRENCY_COOKIE_NAME)?.value,
      userCurrency: user?.currency,
      countryCurrency,
      defaultCode,
      enabled: enabled.map((row) => row.code),
    });
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

export function parseStaffFxRate(value: string) {
  const rateInteger = parseFxMajorRate(value);
  if (rateInteger == null) {
    throw new ApiError(422, "VALIDATION", "Enter a valid exchange rate greater than zero");
  }
  return rateInteger;
}
