import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  countries,
  pricingControls,
  subjects,
  teacherProfiles,
  teacherSubjects,
  users,
} from "@/db/schema";
import {
  resolveEffectiveRateBand,
  type PricingControlRule,
} from "@/lib/teacher-pricing";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import {
  formatMajorAmount,
  formatMinorAmount,
  parseOptionalMajorAmount,
} from "@/server/staff/money";
import type { UpsertPricingControlInput } from "@/server/staff/schemas";

export type PlatformRateLimits = {
  minMinor: number;
  maxMinor: number;
  commissionPercent: number;
  lessonDurationMinutes: number;
  defaultCurrencyCode: string;
  currency: {
    code: string;
    name: string;
    symbol: string;
    decimalPlaces: number;
  } | null;
  currencies: {
    code: string;
    name: string;
    symbol: string;
    decimalPlaces: number;
  }[];
  minAmount: string;
  maxAmount: string;
  minFormatted: string;
  maxFormatted: string;
};

export async function listPricingControlRows(): Promise<PricingControlRule[]> {
  const rows = await db
    .select({
      id: pricingControls.id,
      scope: pricingControls.scope,
      scopeKey: pricingControls.scopeKey,
      minMinor: pricingControls.minMinor,
      maxMinor: pricingControls.maxMinor,
    })
    .from(pricingControls);
  return rows;
}

export async function resolveTeacherRateBand(
  teacherUserId: string,
  platform: PlatformRateLimits,
  extras?: {
    country?: string | null;
    subjectSlugs?: string[];
    rules?: PricingControlRule[];
    labels?: {
      country?: string;
      subjects?: Record<string, string>;
      teacher?: string;
    };
  },
) {
  const [country, subjectSlugs, rules] = await Promise.all([
    extras?.country !== undefined
      ? Promise.resolve(extras.country)
      : loadTeacherCountry(teacherUserId),
    extras?.subjectSlugs
      ? Promise.resolve(extras.subjectSlugs)
      : loadTeacherSubjects(teacherUserId),
    extras?.rules ? Promise.resolve(extras.rules) : listPricingControlRows(),
  ]);

  const countryRule =
    country
      ? rules.find((rule) => rule.scope === "country" && rule.scopeKey === country)
      : null;
  const subjectRules = rules.filter(
    (rule) => rule.scope === "subject" && subjectSlugs.includes(rule.scopeKey),
  );
  const teacherRule =
    rules.find(
      (rule) => rule.scope === "teacher" && rule.scopeKey === teacherUserId,
    ) ?? null;

  return resolveEffectiveRateBand({
    platformMin: platform.minMinor,
    platformMax: platform.maxMinor,
    country: countryRule,
    subjects: subjectRules,
    teacher: teacherRule,
    labels: extras?.labels,
  });
}

export function formatRateLimitView(
  platform: PlatformRateLimits,
  band: ReturnType<typeof resolveEffectiveRateBand>,
  teacherRule?: PricingControlRule | null,
) {
  const currency = platform.currency;
  const decimals = currency?.decimalPlaces ?? 2;
  const symbol = currency?.symbol ?? "";
  return {
    minMinor: band.minMinor,
    maxMinor: band.maxMinor,
    minAmount: formatMajorAmount(band.minMinor, decimals),
    maxAmount: formatMajorAmount(band.maxMinor, decimals),
    minFormatted: currency
      ? formatMinorAmount(band.minMinor, decimals, symbol)
      : String(band.minMinor),
    maxFormatted: currency
      ? formatMinorAmount(band.maxMinor, decimals, symbol)
      : String(band.maxMinor),
    commissionPercent: platform.commissionPercent,
    lessonDurationMinutes: platform.lessonDurationMinutes,
    defaultCurrencyCode: platform.defaultCurrencyCode,
    currencies: platform.currencies,
    sources: band.sources,
    conflict: band.conflict,
    teacherOverride: band.teacherOverride,
    teacherControl: teacherRule
      ? {
          minAmount:
            teacherRule.minMinor != null
              ? formatMajorAmount(teacherRule.minMinor, decimals)
              : "",
          maxAmount:
            teacherRule.maxMinor != null
              ? formatMajorAmount(teacherRule.maxMinor, decimals)
              : "",
        }
      : null,
  };
}

export async function listPricingControlWorkspace(platform: PlatformRateLimits) {
  const [rows, countryRows, subjectRows, teacherRows] = await Promise.all([
    db
      .select({
        id: pricingControls.id,
        scope: pricingControls.scope,
        scopeKey: pricingControls.scopeKey,
        minMinor: pricingControls.minMinor,
        maxMinor: pricingControls.maxMinor,
        updatedAt: pricingControls.updatedAt,
      })
      .from(pricingControls),
    db
      .select({ iso2: countries.iso2, name: countries.name })
      .from(countries)
      .where(eq(countries.isEnabled, true))
      .orderBy(countries.sortOrder),
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    db
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(teacherProfiles)
      .innerJoin(users, eq(teacherProfiles.userId, users.id))
      .orderBy(users.displayName),
  ]);

  const countryName = new Map(countryRows.map((item) => [item.iso2, item.name]));
  const subjectName = new Map(subjectRows.map((item) => [item.slug, item.name]));
  const teacherName = new Map(
    teacherRows.map((item) => [item.userId, item.displayName]),
  );
  const decimals = platform.currency?.decimalPlaces ?? 2;
  const symbol = platform.currency?.symbol ?? "";

  return {
    rules: rows.map((row) => ({
      ...row,
      label:
        row.scope === "country"
          ? countryName.get(row.scopeKey) ?? row.scopeKey
          : row.scope === "subject"
            ? subjectName.get(row.scopeKey) ?? row.scopeKey
            : teacherName.get(row.scopeKey) ?? "Teacher",
      minAmount:
        row.minMinor != null ? formatMajorAmount(row.minMinor, decimals) : "",
      maxAmount:
        row.maxMinor != null ? formatMajorAmount(row.maxMinor, decimals) : "",
      minFormatted:
        row.minMinor != null && platform.currency
          ? formatMinorAmount(row.minMinor, decimals, symbol)
          : row.minMinor != null
            ? String(row.minMinor)
            : "Inherited",
      maxFormatted:
        row.maxMinor != null && platform.currency
          ? formatMinorAmount(row.maxMinor, decimals, symbol)
          : row.maxMinor != null
            ? String(row.maxMinor)
            : "Inherited",
    })),
    countries: countryRows,
    subjects: subjectRows,
    teachers: teacherRows,
  };
}

export async function upsertPricingControl(
  actor: ApiActor,
  input: UpsertPricingControlInput,
  ip: string,
  platform: PlatformRateLimits,
) {
  const scopeKey = await assertScopeKey(input.scope, input.scopeKey);
  const decimals = platform.currency?.decimalPlaces ?? 2;
  const minMinor = parseOptionalMajorAmount(input.minAmount ?? "", decimals);
  const maxMinor = parseOptionalMajorAmount(input.maxAmount ?? "", decimals);
  if (minMinor == null && maxMinor == null) {
    throw new ApiError(422, "VALIDATION", "Add a minimum, a maximum, or both");
  }
  if (minMinor != null && maxMinor != null && minMinor > maxMinor) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Minimum hourly rate cannot be higher than the maximum",
    );
  }

  const [saved] = await db
    .insert(pricingControls)
    .values({
      scope: input.scope,
      scopeKey,
      minMinor,
      maxMinor,
    })
    .onConflictDoUpdate({
      target: [pricingControls.scope, pricingControls.scopeKey],
      set: { minMinor, maxMinor },
    })
    .returning();

  await writeAuditLog({
    actor,
    action: "settings.pricing_control_upserted",
    entityType: "pricing_control",
    entityId: saved?.id,
    ipAddress: ip,
    metadata: { scope: input.scope, scopeKey, minMinor, maxMinor },
  });

  return saved;
}

export async function deletePricingControl(
  actor: ApiActor,
  ruleId: string,
  ip: string,
) {
  const [current] = await db
    .select({ id: pricingControls.id })
    .from(pricingControls)
    .where(eq(pricingControls.id, ruleId))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pricing control not found");
  }

  await db.delete(pricingControls).where(eq(pricingControls.id, ruleId));
  await writeAuditLog({
    actor,
    action: "settings.pricing_control_deleted",
    entityType: "pricing_control",
    entityId: ruleId,
    ipAddress: ip,
  });
  return { id: ruleId };
}

async function assertScopeKey(
  scope: UpsertPricingControlInput["scope"],
  rawKey: string,
) {
  const scopeKey = rawKey.trim();
  if (scope === "country") {
    const [row] = await db
      .select({ iso2: countries.iso2 })
      .from(countries)
      .where(and(eq(countries.iso2, scopeKey.toUpperCase()), eq(countries.isEnabled, true)))
      .limit(1);
    if (!row) {
      throw new ApiError(422, "VALIDATION", "Country is not available");
    }
    return row.iso2;
  }
  if (scope === "subject") {
    const [row] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(and(eq(subjects.slug, scopeKey), eq(subjects.isEnabled, true)))
      .limit(1);
    if (!row) {
      throw new ApiError(422, "VALIDATION", "Subject is not available");
    }
    return row.slug;
  }

  const [row] = await db
    .select({ userId: teacherProfiles.userId })
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, scopeKey))
    .limit(1);
  if (!row) {
    throw new ApiError(422, "VALIDATION", "Teacher not found");
  }
  return row.userId;
}

async function loadTeacherCountry(teacherUserId: string) {
  const [row] = await db
    .select({ country: users.country })
    .from(users)
    .where(eq(users.id, teacherUserId))
    .limit(1);
  return row?.country ?? null;
}

async function loadTeacherSubjects(teacherUserId: string) {
  const rows = await db
    .select({ slug: teacherSubjects.subjectSlug })
    .from(teacherSubjects)
    .where(eq(teacherSubjects.teacherUserId, teacherUserId));
  return rows.map((row) => row.slug);
}

