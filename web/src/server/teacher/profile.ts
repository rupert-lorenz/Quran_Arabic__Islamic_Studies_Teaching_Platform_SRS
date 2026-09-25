import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  countries,
  currencies,
  platformSettings,
  subjects,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { formatMoneyMinor, splitLessonRate } from "@/lib/teacher-rate-display";
import {
  normalizeTeacherGender,
  parseAudienceList,
  serializeAudienceList,
} from "@/lib/teacher-search";
import { convertToPlatformMinor, getRequestMoney } from "@/server/money/currency";
import { formatMajorAmount, formatMinorAmount, parseMajorAmount } from "@/server/staff/money";
import { latestTeacherPhotoUrl } from "./photo";
import {
  formatRateLimitView,
  listPricingControlRows,
  resolveTeacherRateBand,
} from "./pricing";
import type { UpdateTeacherProfileInput, UpdateTeacherRateInput } from "./schemas";

const DEFAULT_RATE_MIN_MINOR = 500;
const DEFAULT_RATE_MAX_MINOR = 20000;
const DEFAULT_COMMISSION_PERCENT = 20;
const DEFAULT_LESSON_DURATION_MINUTES = 30;
const DEFAULT_CURRENCY_CODE = "GBP";

export type PublicTeacherRate = {
  amountMinor: number;
  currencyCode: string;
  amount: string;
  formatted: string;
  studentPays: string;
  teacherEarns: string;
  teacherEarnsMinor: number;
  commissionAmount: string;
  commissionPercent: number;
};

export async function writeTeacherProfileFields(
  userId: string,
  input: UpdateTeacherProfileInput,
) {
  const subjectRows = await db
    .select({ slug: subjects.slug })
    .from(subjects)
    .where(
      and(inArray(subjects.slug, input.subjectSlugs), eq(subjects.isEnabled, true)),
    );

  if (subjectRows.length !== input.subjectSlugs.length) {
    throw new ApiError(422, "VALIDATION", "One or more subjects are invalid");
  }

  const [country] = await db
    .select({ iso2: countries.iso2 })
    .from(countries)
    .where(
      and(
        eq(countries.iso2, input.country.toUpperCase()),
        eq(countries.isEnabled, true),
      ),
    )
    .limit(1);

  if (!country) {
    throw new ApiError(422, "VALIDATION", "Country is not available");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(teacherProfiles)
      .set({
        headline: input.headline,
        bio: input.bio,
        languages: input.languages,
        gender: normalizeTeacherGender(input.gender),
        audiences: serializeAudienceList(input.audienceSlugs ?? []) || null,
      })
      .where(eq(teacherProfiles.userId, userId));
    await tx
      .update(users)
      .set({ country: country.iso2 })
      .where(eq(users.id, userId));
    await tx
      .delete(teacherSubjects)
      .where(eq(teacherSubjects.teacherUserId, userId));
    await tx.insert(teacherSubjects).values(
      subjectRows.map((subject) => ({
        teacherUserId: userId,
        subjectSlug: subject.slug,
      })),
    );
  });
}

export async function getManagedTeacherProfile(userId: string) {
  const [row] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      country: users.country,
      headline: teacherProfiles.headline,
      bio: teacherProfiles.bio,
      languages: teacherProfiles.languages,
      gender: teacherProfiles.gender,
      audiences: teacherProfiles.audiences,
      hourlyRateMinor: teacherProfiles.hourlyRateMinor,
      currencyCode: teacherProfiles.currencyCode,
      verificationStatus: teacherProfiles.verificationStatus,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);

  if (!row || row.verificationStatus !== "approved") {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found");
  }

  const [subjectRows, catalog, countryRows, currencyRows, limits] =
    await Promise.all([
      db
        .select({ slug: teacherSubjects.subjectSlug })
        .from(teacherSubjects)
        .where(eq(teacherSubjects.teacherUserId, userId)),
      db
        .select({ slug: subjects.slug, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.isEnabled, true))
        .orderBy(subjects.sortOrder),
      db
        .select({ iso2: countries.iso2, name: countries.name })
        .from(countries)
        .where(eq(countries.isEnabled, true))
        .orderBy(countries.sortOrder),
      db
        .select({
          code: currencies.code,
          name: currencies.name,
          symbol: currencies.symbol,
          decimalPlaces: currencies.decimalPlaces,
        })
        .from(currencies)
        .where(eq(currencies.isEnabled, true))
        .orderBy(currencies.code),
      getTeacherRateLimits(),
    ]);

  const photoUrl = await latestTeacherPhotoUrl(userId);

  const currency =
    currencyRows.find((item) => item.code === row.currencyCode) ??
    currencyRows.find((item) => item.code === "GBP") ??
    currencyRows[0];

  return {
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
    publicPath: `/teachers/${row.userId}`,
    photoUrl,
    profile: {
      headline: row.headline ?? "",
      bio: row.bio ?? "",
      languages: row.languages ?? "",
      country: row.country ?? "",
      gender: row.gender ?? "",
      audienceSlugs: parseAudienceList(row.audiences),
      subjectSlugs: subjectRows.map((item) => item.slug),
    },
    rate: publicTeacherRate(row.hourlyRateMinor, currency, limits.commissionPercent),
    rateLimits: await teacherRateLimitView(row.userId, limits, {
      country: row.country,
      subjectSlugs: subjectRows.map((item) => item.slug),
    }),
    catalog,
    countries: countryRows,
    currencies: currencyRows,
  };
}

export async function updateManagedTeacherProfile(
  actor: ApiActor,
  input: UpdateTeacherProfileInput,
  ip: string,
) {
  await requireApprovedTeacherProfile(actor.userId);
  await writeTeacherProfileFields(actor.userId, input);
  await writeAuditLog({
    actor,
    action: "teachers.profile_updated",
    entityType: "teacher_profile",
    entityId: actor.userId,
    ipAddress: ip,
  });
  return getManagedTeacherProfile(actor.userId);
}

export async function writeTeacherHourlyRate(
  teacherUserId: string,
  input: UpdateTeacherRateInput,
) {
  const [currency] = await db
    .select()
    .from(currencies)
    .where(eq(currencies.code, input.currencyCode.toUpperCase()))
    .limit(1);

  if (!currency?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "Currency is not available");
  }

  const amountMinor = parseMajorAmount(input.amount, currency.decimalPlaces);
  const platform = await getTeacherRateLimits();
  const band = await resolveTeacherRateBand(teacherUserId, platform);
  if (band.conflict) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Pricing controls for this teacher conflict. Staff need to widen the country, subject, or teacher range.",
    );
  }
  const platformAmount = await convertToPlatformMinor(amountMinor, {
    code: currency.code,
    decimalPlaces: currency.decimalPlaces,
  });
  if (
    platformAmount.amountMinor < band.minMinor ||
    platformAmount.amountMinor > band.maxMinor
  ) {
    const { convert } = await getRequestMoney();
    const listing = {
      code: currency.code,
      decimalPlaces: currency.decimalPlaces,
      symbol: currency.symbol,
    };
    const minLocal = platform.currency
      ? convert(band.minMinor, platform.currency, listing)
      : null;
    const maxLocal = platform.currency
      ? convert(band.maxMinor, platform.currency, listing)
      : null;
    const minLabel =
      minLocal != null
        ? formatMinorAmount(minLocal, currency.decimalPlaces, currency.symbol)
        : formatMinorAmount(
            band.minMinor,
            platform.currency?.decimalPlaces ?? currency.decimalPlaces,
            platform.currency?.symbol ?? currency.symbol,
          );
    const maxLabel =
      maxLocal != null
        ? formatMinorAmount(maxLocal, currency.decimalPlaces, currency.symbol)
        : formatMinorAmount(
            band.maxMinor,
            platform.currency?.decimalPlaces ?? currency.decimalPlaces,
            platform.currency?.symbol ?? currency.symbol,
          );
    throw new ApiError(
      422,
      "VALIDATION",
      `Hourly rate must be between ${minLabel} and ${maxLabel}`,
    );
  }

  await db
    .update(teacherProfiles)
    .set({
      hourlyRateMinor: amountMinor,
      currencyCode: currency.code,
    })
    .where(eq(teacherProfiles.userId, teacherUserId));

  return {
    amountMinor,
    currencyCode: currency.code,
    rate: publicTeacherRate(amountMinor, currency, platform.commissionPercent),
  };
}

export async function updateTeacherRate(
  actor: ApiActor,
  input: UpdateTeacherRateInput,
  ip: string,
) {
  await requireApprovedTeacherProfile(actor.userId);
  const saved = await writeTeacherHourlyRate(actor.userId, input);
  await writeAuditLog({
    actor,
    action: "teachers.rate_updated",
    entityType: "teacher_profile",
    entityId: actor.userId,
    ipAddress: ip,
    metadata: saved,
  });
  return getManagedTeacherProfile(actor.userId);
}

export async function updateStaffTeacherRate(
  actor: ApiActor,
  teacherUserId: string,
  input: UpdateTeacherRateInput,
  ip: string,
) {
  const [current] = await db
    .select({ userId: teacherProfiles.userId })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, teacherUserId))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  }

  const saved = await writeTeacherHourlyRate(teacherUserId, input);
  await writeAuditLog({
    actor,
    action: "teachers.rate_updated",
    entityType: "teacher_profile",
    entityId: teacherUserId,
    ipAddress: ip,
    metadata: saved,
  });
  return saved;
}

export function publicTeacherRate(
  amountMinor: number | null | undefined,
  currency:
    | {
        code: string;
        symbol: string;
        decimalPlaces: number;
      }
    | null
    | undefined,
  commissionPercent: number,
) {
  if (!amountMinor || !currency) {
    return null;
  }

  const studentPays = formatMoneyMinor(
    amountMinor,
    currency.decimalPlaces,
    currency.symbol,
  );
  const { teacherEarnsMinor, commissionMinor } = splitLessonRate(
    amountMinor,
    commissionPercent,
  );

  return {
    amountMinor,
    currencyCode: currency.code,
    amount: formatMajorAmount(amountMinor, currency.decimalPlaces),
    formatted: `${studentPays} / hour`,
    studentPays,
    teacherEarns: formatMoneyMinor(
      teacherEarnsMinor,
      currency.decimalPlaces,
      currency.symbol,
    ),
    teacherEarnsMinor,
    commissionAmount: formatMoneyMinor(
      commissionMinor,
      currency.decimalPlaces,
      currency.symbol,
    ),
    commissionPercent,
  };
}

export async function getTeacherRateLimits() {
  const [rows, currencyRows] = await Promise.all([
    db
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings)
      .where(
        inArray(platformSettings.key, [
          "teacher.rate.min_minor",
          "teacher.rate.max_minor",
          "commission.default_percent",
          "platform.default_currency",
          "lesson.default_duration_minutes",
        ]),
      ),
    db
      .select({
        code: currencies.code,
        name: currencies.name,
        symbol: currencies.symbol,
        decimalPlaces: currencies.decimalPlaces,
      })
      .from(currencies)
      .where(eq(currencies.isEnabled, true))
      .orderBy(currencies.code),
  ]);

  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const defaultCurrencyCode = String(
    byKey.get("platform.default_currency") ?? DEFAULT_CURRENCY_CODE,
  ).toUpperCase();
  const currency =
    currencyRows.find((item) => item.code === defaultCurrencyCode) ??
    currencyRows.find((item) => item.code === DEFAULT_CURRENCY_CODE) ??
    currencyRows[0];
  const minMinor = numberSetting(
    byKey.get("teacher.rate.min_minor"),
    DEFAULT_RATE_MIN_MINOR,
  );
  const maxMinor = numberSetting(
    byKey.get("teacher.rate.max_minor"),
    DEFAULT_RATE_MAX_MINOR,
  );
  const decimals = currency?.decimalPlaces ?? 2;

  return {
    minMinor,
    maxMinor,
    commissionPercent: numberSetting(
      byKey.get("commission.default_percent"),
      DEFAULT_COMMISSION_PERCENT,
    ),
    lessonDurationMinutes: numberSetting(
      byKey.get("lesson.default_duration_minutes"),
      DEFAULT_LESSON_DURATION_MINUTES,
    ),
    defaultCurrencyCode: currency?.code ?? DEFAULT_CURRENCY_CODE,
    currency: currency ?? null,
    currencies: currencyRows,
    minAmount: formatMajorAmount(minMinor, decimals),
    maxAmount: formatMajorAmount(maxMinor, decimals),
    minFormatted: currency
      ? formatMinorAmount(minMinor, currency.decimalPlaces, currency.symbol)
      : String(minMinor),
    maxFormatted: currency
      ? formatMinorAmount(maxMinor, currency.decimalPlaces, currency.symbol)
      : String(maxMinor),
  };
}

export async function requireApprovedTeacherProfile(userId: string) {
  const [row] = await db
    .select({
      verificationStatus: teacherProfiles.verificationStatus,
      status: users.status,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found");
  }
  if (row.verificationStatus !== "approved" || row.status !== "active") {
    throw new ApiError(400, "LOCKED", "Only approved teachers can manage this profile");
  }
  return row;
}

export async function teacherRateLimitView(
  teacherUserId: string,
  platform: Awaited<ReturnType<typeof getTeacherRateLimits>>,
  extras?: { country?: string | null; subjectSlugs?: string[] },
) {
  const rules = await listPricingControlRows();
  const band = await resolveTeacherRateBand(teacherUserId, platform, {
    ...extras,
    rules,
  });
  return formatRateLimitView(
    platform,
    band,
    rules.find(
      (rule) => rule.scope === "teacher" && rule.scopeKey === teacherUserId,
    ) ?? null,
  );
}

function numberSetting(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
