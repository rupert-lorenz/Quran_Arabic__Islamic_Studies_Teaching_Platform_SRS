import { presentStudentAmount } from "@/lib/currency";
import { splitLessonRate } from "@/lib/teacher-rate-display";
import type { ApiActor } from "@/server/api/auth";
import { getRequestMoney } from "@/server/money/currency";
import { formatMinorAmount } from "@/server/staff/money";
import { getTeacherRateLimits } from "@/server/teacher/profile";

type Money = Awaited<ReturnType<typeof getRequestMoney>>;
type Limits = Awaited<ReturnType<typeof getTeacherRateLimits>>;

function conversionActive(money: Money) {
  return (
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code))
  );
}

function listingOf(limits: Limits, money: Money) {
  return (
    limits.currency ?? {
      code: money.currency.code,
      symbol: money.currency.symbol,
      decimalPlaces: money.currency.decimalPlaces,
    }
  );
}

function presentPart(
  money: Money,
  listing: { code: string; symbol: string; decimalPlaces: number },
  amountMinor: number,
) {
  return presentStudentAmount({
    amountMinor,
    listing: {
      code: listing.code,
      symbol: listing.symbol,
      decimalPlaces: listing.decimalPlaces,
    },
    display: money.currency,
    convert: money.convert,
  });
}

function emptyFaculty(money: Money, limits: Limits) {
  const listing = listingOf(limits, money);
  const zero = formatMinorAmount(
    0,
    money.currency.decimalPlaces,
    money.currency.symbol,
  );
  return {
    display: money.currency,
    conversionActive: conversionActive(money),
    percent: limits.commissionPercent,
    maxPercent: 80,
    hasFixed: limits.commissionFixedMinor > 0,
    fixedFormatted: presentPart(money, listing, limits.commissionFixedMinor)
      .studentPriceFormatted,
    listedFixedFormatted: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    example: {
      grossFormatted: zero,
      commissionFormatted: zero,
      netFormatted: zero,
      listedGrossFormatted: null as string | null,
    },
  };
}

export async function getCommissionRulesFaculty(actor: ApiActor) {
  const [money, limits] = await Promise.all([
    getRequestMoney(),
    getTeacherRateLimits(),
  ]);
  if (actor.roleKey === "parent" || actor.roleKey === "student") {
    return emptyFaculty(money, limits);
  }

  const listing = listingOf(limits, money);
  const exampleAmount = Math.max(0, limits.minMinor);
  const split = splitLessonRate(
    exampleAmount,
    limits.commissionPercent,
    limits.commissionFixedMinor,
  );
  const gross = presentPart(money, listing, exampleAmount);
  const commission = presentPart(money, listing, split.commissionMinor);
  const net = presentPart(money, listing, split.teacherEarnsMinor);
  const fixed = presentPart(money, listing, limits.commissionFixedMinor);

  return {
    display: money.currency,
    conversionActive: conversionActive(money),
    percent: limits.commissionPercent,
    maxPercent: 80,
    hasFixed: limits.commissionFixedMinor > 0,
    fixedFormatted: fixed.studentPriceFormatted,
    listedFixedFormatted: limits.currency
      ? formatMinorAmount(
          limits.commissionFixedMinor,
          limits.currency.decimalPlaces,
          limits.currency.symbol,
        )
      : String(limits.commissionFixedMinor),
    example: {
      grossFormatted: gross.studentPriceFormatted,
      commissionFormatted: commission.studentPriceFormatted,
      netFormatted: net.studentPriceFormatted,
      listedGrossFormatted: gross.listedPriceFormatted,
    },
  };
}
