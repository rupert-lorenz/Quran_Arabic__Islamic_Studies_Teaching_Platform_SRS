import { eq } from "drizzle-orm";
import { db } from "@/db";
import { countries } from "@/db/schema";
import { getRequestMoney } from "@/server/money/currency";
import { getTeacherRateLimits } from "@/server/teacher/profile";
import {
  listPricingControlRows,
  listPricingControlWorkspace,
  resolveTeacherRateBand,
} from "@/server/teacher/pricing";
import { formatMinorAmount } from "@/server/staff/money";

export async function getLocationPriceFaculty(options?: {
  includeRules?: boolean;
}) {
  const includeRules = options?.includeRules !== false;
  const [money, platform, rules] = await Promise.all([
    getRequestMoney(),
    getTeacherRateLimits(),
    listPricingControlRows(),
  ]);
  const workspace = includeRules
    ? await listPricingControlWorkspace(platform)
    : { rules: [] };
  const countryIso2 = money.country?.iso2 ?? null;
  const [countryRow] = countryIso2
    ? await db
        .select({
          iso2: countries.iso2,
          name: countries.name,
          defaultCurrencyCode: countries.defaultCurrencyCode,
        })
        .from(countries)
        .where(eq(countries.iso2, countryIso2))
        .limit(1)
    : [null];
  const countryRule = countryIso2
    ? rules.find((rule) => rule.scope === "country" && rule.scopeKey === countryIso2)
    : null;
  const marketBand =
    includeRules && countryIso2
      ? await resolveTeacherRateBand(
          "00000000-0000-0000-0000-000000000000",
          platform,
          {
            country: countryIso2,
            subjectSlugs: [],
            rules,
            labels: { country: countryRow?.name },
          },
        )
      : null;
  const decimals = platform.currency?.decimalPlaces ?? 2;
  const symbol = platform.currency?.symbol ?? "";
  const conversionActive =
    money.currency.code !== money.defaultCode &&
    (money.currency.code === money.book.baseCode ||
      money.book.rates.has(money.currency.code));

  return {
    display: money.currency,
    defaultCode: money.defaultCode,
    marketSource: money.marketSource,
    country: countryRow
      ? {
          iso2: countryRow.iso2,
          name: countryRow.name,
          currencyCode: countryRow.defaultCurrencyCode,
        }
      : null,
    conversionActive,
    countryRuleConfigured: Boolean(countryRule),
    platformBand: {
      minFormatted: platform.minFormatted,
      maxFormatted: platform.maxFormatted,
    },
    marketBand:
      marketBand && countryRule
        ? {
            minFormatted: formatMinorAmount(marketBand.minMinor, decimals, symbol),
            maxFormatted: formatMinorAmount(marketBand.maxMinor, decimals, symbol),
            conflict: marketBand.conflict,
          }
        : null,
    rules: workspace.rules.map((rule) => ({
      id: rule.id,
      scope: rule.scope,
      label: rule.label,
      minFormatted: rule.minFormatted,
      maxFormatted: rule.maxFormatted,
    })),
    counts: {
      country: rules.filter((rule) => rule.scope === "country").length,
      subject: rules.filter((rule) => rule.scope === "subject").length,
      teacher: rules.filter((rule) => rule.scope === "teacher").length,
    },
  };
}
