import { eq } from "drizzle-orm";
import { db } from "@/db";
import { currencies, platformSettings } from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { parseMajorAmount, parseNonNegativeMajorAmount } from "./money";
import { getTeacherRateLimits } from "@/server/teacher/profile";
import { getBookingPolicy } from "@/server/booking/policy";
import {
  deletePricingControl,
  listPricingControlWorkspace,
  upsertPricingControl,
} from "@/server/teacher/pricing";
import type {
  UpdateTeacherRatePolicyInput,
  UpsertPricingControlInput,
} from "./schemas";

export async function getTeacherRatePolicy() {
  const [platform, booking] = await Promise.all([
    getTeacherRateLimits(),
    getBookingPolicy(),
  ]);
  const workspace = await listPricingControlWorkspace(platform);
  return {
    ...platform,
    ...workspace,
    minNoticeMinutes: booking.minNoticeMinutes,
    cancelNoticeMinutes: booking.cancelNoticeMinutes,
    minCommitmentLessons: booking.minCommitmentLessons,
  };
}

export async function updateTeacherRatePolicy(
  actor: ApiActor,
  input: UpdateTeacherRatePolicyInput,
  ip: string,
) {
  const [currency] = await db
    .select()
    .from(currencies)
    .where(eq(currencies.code, input.defaultCurrencyCode.toUpperCase()))
    .limit(1);
  if (!currency?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "Currency is not available");
  }

  const minMinor = parseMajorAmount(input.minAmount, currency.decimalPlaces);
  const maxMinor = parseMajorAmount(input.maxAmount, currency.decimalPlaces);
  if (minMinor > maxMinor) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Minimum hourly rate cannot be higher than the maximum",
    );
  }

  const settings = [
    { key: "teacher.rate.min_minor", value: minMinor },
    { key: "teacher.rate.max_minor", value: maxMinor },
    { key: "commission.default_percent", value: input.commissionPercent },
    {
      key: "commission.default_fixed_minor",
      value: parseNonNegativeMajorAmount(
        input.commissionFixedAmount ?? "0",
        currency.decimalPlaces,
      ),
    },
    { key: "platform.default_currency", value: currency.code },
    { key: "lesson.default_duration_minutes", value: input.lessonDurationMinutes },
    ...(input.minNoticeMinutes != null
      ? [{ key: "booking.min_notice_minutes", value: input.minNoticeMinutes }]
      : []),
    ...(input.cancelNoticeMinutes != null
      ? [{ key: "booking.cancel_notice_minutes", value: input.cancelNoticeMinutes }]
      : []),
    ...(input.minCommitmentLessons != null
      ? [{ key: "booking.min_commitment_lessons", value: input.minCommitmentLessons }]
      : []),
  ];

  for (const setting of settings) {
    await db
      .insert(platformSettings)
      .values({ key: setting.key, value: setting.value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: setting.value },
      });
  }

  await writeAuditLog({
    actor,
    action: "settings.rate_policy_updated",
    entityType: "platform_settings",
    entityId: "teacher.rate",
    ipAddress: ip,
    metadata: {
      minMinor,
      maxMinor,
      commissionPercent: input.commissionPercent,
      commissionFixedMinor: parseNonNegativeMajorAmount(
        input.commissionFixedAmount ?? "0",
        currency.decimalPlaces,
      ),
      defaultCurrencyCode: currency.code,
      lessonDurationMinutes: input.lessonDurationMinutes,
      minNoticeMinutes: input.minNoticeMinutes,
      cancelNoticeMinutes: input.cancelNoticeMinutes,
      minCommitmentLessons: input.minCommitmentLessons,
    },
  });

  return getTeacherRatePolicy();
}

export async function upsertTeacherPricingControl(
  actor: ApiActor,
  input: UpsertPricingControlInput,
  ip: string,
) {
  const platform = await getTeacherRateLimits();
  await upsertPricingControl(actor, input, ip, platform);
  return getTeacherRatePolicy();
}

export async function removeTeacherPricingControl(
  actor: ApiActor,
  ruleId: string,
  ip: string,
) {
  await deletePricingControl(actor, ruleId, ip);
  return getTeacherRatePolicy();
}
