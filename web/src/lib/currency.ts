import { normalizeCurrencyCode } from "@/lib/geo";
import { formatMoneyMinor, splitLessonRate, type TeacherRateView } from "@/lib/teacher-rate-display";

export const CURRENCY_COOKIE_NAME = "tp_currency";
export const DEFAULT_CURRENCY = "GBP";
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const FX_RATE_SCALE = 8;

export type PublicCurrency = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isDefault: boolean;
};

export type FxRateQuote = {
  quoteCode: string;
  rateInteger: number;
  rateScale: number;
};

export type FxBook = {
  baseCode: string;
  rates: Map<string, number>;
};

export function resolveCurrencyCode(input: {
  cookie?: string | null;
  userCurrency?: string | null;
  countryCurrency?: string | null;
  defaultCode: string;
  enabled: string[];
}) {
  const enabled = input.enabled.map((code) => code.toUpperCase());
  const fallback =
    enabled.find((code) => code === input.defaultCode.toUpperCase()) ??
    enabled[0] ??
    DEFAULT_CURRENCY;
  const candidates = [
    normalizeCurrencyCode(input.cookie),
    normalizeCurrencyCode(input.userCurrency),
    normalizeCurrencyCode(input.countryCurrency),
  ];
  for (const candidate of candidates) {
    if (candidate && enabled.includes(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

export function parseFxMajorRate(value: string, scale = FX_RATE_SCALE) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > scale) {
    return null;
  }
  const integer =
    Number(whole) * 10 ** scale + Number(fraction.padEnd(scale, "0") || "0");
  if (!Number.isSafeInteger(integer) || integer <= 0) {
    return null;
  }
  return integer;
}

export function formatFxMajorRate(rateInteger: number, scale = FX_RATE_SCALE) {
  const factor = 10 ** scale;
  const major = (rateInteger / factor).toFixed(scale).replace(/\.?0+$/, "");
  return major.includes(".") ? major : `${major}.0`;
}

function mulDivRound(amount: bigint, multiplier: bigint, divisor: bigint) {
  if (divisor === BigInt(0)) {
    return null;
  }
  const product = amount * multiplier;
  const rounded = (product + divisor / BigInt(2)) / divisor;
  const asNumber = Number(rounded);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

export function convertMinorAmount(input: {
  amountMinor: number;
  from: { code: string; decimalPlaces: number };
  to: { code: string; decimalPlaces: number };
  book: FxBook;
}) {
  if (input.from.code === input.to.code) {
    return input.amountMinor;
  }

  const scale = 10 ** FX_RATE_SCALE;
  const fromRate =
    input.from.code === input.book.baseCode
      ? scale
      : (input.book.rates.get(input.from.code) ?? null);
  const toRate =
    input.to.code === input.book.baseCode
      ? scale
      : (input.book.rates.get(input.to.code) ?? null);
  if (fromRate == null || toRate == null || fromRate <= 0 || toRate <= 0) {
    return null;
  }

  return mulDivRound(
    BigInt(input.amountMinor),
    BigInt(toRate) * BigInt(10) ** BigInt(input.to.decimalPlaces),
    BigInt(fromRate) * BigInt(10) ** BigInt(input.from.decimalPlaces),
  );
}

export function presentStudentAmount(input: {
  amountMinor: number;
  listing: { code: string; symbol: string; decimalPlaces: number } | null;
  display: { code: string; symbol: string; decimalPlaces: number };
  convert: (
    amountMinor: number,
    from: { code: string; decimalPlaces: number },
    to: { code: string; decimalPlaces: number },
  ) => number | null;
  sessionCount?: number;
}) {
  const sessions = Math.max(1, input.sessionCount ?? 1);
  const listing = input.listing;
  const convertedMinor =
    listing && listing.code !== input.display.code
      ? input.convert(input.amountMinor, listing, input.display)
      : input.amountMinor;
  const useDisplay =
    listing != null &&
    listing.code !== input.display.code &&
    convertedMinor != null;
  const currency = useDisplay ? input.display : listing;
  const studentPriceMinor = convertedMinor ?? input.amountMinor;
  const studentPriceFormatted = currency
    ? formatMoneyMinor(studentPriceMinor, currency.decimalPlaces, currency.symbol)
    : `${studentPriceMinor}`;
  const seriesTotalMinor = studentPriceMinor * sessions;
  return {
    studentPriceMinor,
    studentPriceFormatted,
    seriesTotalMinor,
    seriesTotalFormatted: currency
      ? formatMoneyMinor(seriesTotalMinor, currency.decimalPlaces, currency.symbol)
      : `${seriesTotalMinor}`,
    listedPriceFormatted:
      useDisplay && listing
        ? formatMoneyMinor(input.amountMinor, listing.decimalPlaces, listing.symbol)
        : null,
    priceConverted: Boolean(useDisplay),
    currencyCode: currency?.code ?? listing?.code ?? input.display.code,
    sessionCount: sessions,
  };
}

export function localizeTeacherRate(
  rate: {
    amountMinor: number;
    currencyCode: string;
    amount: string;
    formatted: string;
    studentPays: string;
    teacherEarns?: string;
    teacherEarnsMinor?: number;
    commissionAmount?: string;
    commissionPercent?: number;
  } | null,
  listing: { code: string; symbol: string; decimalPlaces: number } | null,
  display: PublicCurrency,
  book: FxBook,
): TeacherRateView | null {
  if (!rate || !listing) {
    return null;
  }

  const convertedMinor = convertMinorAmount({
    amountMinor: rate.amountMinor,
    from: listing,
    to: display,
    book,
  });
  if (convertedMinor == null || listing.code === display.code) {
    return {
      amountMinor: rate.amountMinor,
      amount: rate.amount,
      currencyCode: rate.currencyCode,
      formatted: rate.formatted,
      studentPays: rate.studentPays,
      ...(rate.teacherEarns != null ? { teacherEarns: rate.teacherEarns } : {}),
      ...(rate.commissionAmount != null
        ? { commissionAmount: rate.commissionAmount }
        : {}),
      ...(rate.commissionPercent != null
        ? { commissionPercent: rate.commissionPercent }
        : {}),
    };
  }

  const studentPays = formatMoneyMinor(
    convertedMinor,
    display.decimalPlaces,
    display.symbol,
  );
  const internals =
    rate.commissionPercent != null
      ? (() => {
          const { teacherEarnsMinor, commissionMinor } = splitLessonRate(
            convertedMinor,
            rate.commissionPercent,
          );
          return {
            teacherEarns: formatMoneyMinor(
              teacherEarnsMinor,
              display.decimalPlaces,
              display.symbol,
            ),
            commissionAmount: formatMoneyMinor(
              commissionMinor,
              display.decimalPlaces,
              display.symbol,
            ),
            commissionPercent: rate.commissionPercent,
          };
        })()
      : {};

  return {
    amountMinor: convertedMinor,
    amount: (convertedMinor / 10 ** display.decimalPlaces).toFixed(
      display.decimalPlaces,
    ),
    currencyCode: display.code,
    formatted: `${studentPays} / hour`,
    studentPays,
    ...internals,
    listedFormatted: rate.formatted,
    converted: true,
  };
}

export const seedFxRatesAgainstGbp: { quoteCode: string; rate: string }[] = [
  { quoteCode: "GBP", rate: "1" },
  { quoteCode: "USD", rate: "1.27" },
  { quoteCode: "EUR", rate: "1.18" },
  { quoteCode: "SAR", rate: "4.76" },
  { quoteCode: "AED", rate: "4.66" },
  { quoteCode: "PKR", rate: "370" },
  { quoteCode: "INR", rate: "106" },
  { quoteCode: "MYR", rate: "5.35" },
  { quoteCode: "IDR", rate: "20200" },
  { quoteCode: "TRY", rate: "51" },
  { quoteCode: "CAD", rate: "1.73" },
  { quoteCode: "AUD", rate: "1.91" },
  { quoteCode: "EGP", rate: "62" },
  { quoteCode: "NGN", rate: "2050" },
];
