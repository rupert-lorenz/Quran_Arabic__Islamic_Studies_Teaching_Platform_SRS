import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { countries, platformSettings, teacherProfiles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_BOOKING_CANCEL_NOTICE_MINUTES,
  DEFAULT_BOOKING_MIN_COMMITMENT,
  DEFAULT_BOOKING_MIN_NOTICE_MINUTES,
  BOOKING_NOTICE_OPTIONS_MINUTES,
  DEFAULT_TRIAL_DURATION_MINUTES,
  DEFAULT_TRIAL_PRICE_PERCENT,
  MAX_RECURRING_WEEKS,
  effectiveMinNoticeMinutes,
  effectiveMinCommitmentLessons,
  formatNoticeDuration,
  noticeOptionMinutes,
} from "@/lib/booking";
import { DEFAULT_LESSON_DURATION_MINUTES } from "@/lib/lesson-history";
import { normalizeTimezone, timezoneOptions } from "@/lib/geo";
import { DEFAULT_TIMEZONE, TIMEZONE_COOKIE_NAME } from "@/lib/timezone";
import { getTeacherRateLimits } from "@/server/teacher/profile";
import { ApiError } from "@/server/api/errors";
import { cookies } from "next/headers";

function numberSetting(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getBookingPolicy() {
  const [rows, rates] = await Promise.all([
    db
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings)
      .where(
        inArray(platformSettings.key, [
          "booking.min_notice_minutes",
          "booking.cancel_notice_minutes",
          "booking.min_commitment_lessons",
          "lesson.default_duration_minutes",
          "booking.trial_duration_minutes",
          "booking.trial_price_percent",
        ]),
      ),
    getTeacherRateLimits(),
  ]);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    minNoticeMinutes: numberSetting(
      byKey.get("booking.min_notice_minutes"),
      DEFAULT_BOOKING_MIN_NOTICE_MINUTES,
    ),
    cancelNoticeMinutes: numberSetting(
      byKey.get("booking.cancel_notice_minutes"),
      DEFAULT_BOOKING_CANCEL_NOTICE_MINUTES,
    ),
    minCommitmentLessons: Math.min(
      MAX_RECURRING_WEEKS,
      Math.max(
        1,
        numberSetting(
          byKey.get("booking.min_commitment_lessons"),
          DEFAULT_BOOKING_MIN_COMMITMENT,
        ),
      ),
    ),
    lessonDurationMinutes: numberSetting(
      byKey.get("lesson.default_duration_minutes"),
      DEFAULT_LESSON_DURATION_MINUTES,
    ),
    trialDurationMinutes: Math.max(
      15,
      Math.min(
        90,
        numberSetting(
          byKey.get("booking.trial_duration_minutes"),
          DEFAULT_TRIAL_DURATION_MINUTES,
        ),
      ),
    ),
    trialPricePercent: Math.max(
      0,
      Math.min(
        100,
        numberSetting(
          byKey.get("booking.trial_price_percent"),
          DEFAULT_TRIAL_PRICE_PERCENT,
        ),
      ),
    ),
    rates,
  };
}

export function bookingNoticeView(
  platformMinutes: number,
  teacherMinutes?: number | null,
) {
  const effectiveMinutes = effectiveMinNoticeMinutes(platformMinutes, teacherMinutes);
  return {
    platformMinutes,
    teacherMinutes: teacherMinutes ?? null,
    effectiveMinutes,
    options: noticeOptionMinutes(effectiveMinutes, BOOKING_NOTICE_OPTIONS_MINUTES)
      .filter((minutes) => minutes >= platformMinutes)
      .map((minutes) => ({
        minutes,
        label: formatNoticeDuration(minutes),
      })),
  };
}

export function bookingCommitmentView(
  platformLessons: number,
  teacherLessons?: number | null,
) {
  const effectiveLessons = effectiveMinCommitmentLessons(
    platformLessons,
    teacherLessons,
  );
  return {
    platformLessons,
    teacherLessons: teacherLessons ?? null,
    effectiveLessons,
    options: Array.from(
      { length: MAX_RECURRING_WEEKS - platformLessons + 1 },
      (_, index) => platformLessons + index,
    ),
  };
}

export async function resolveTeacherMinNotice(teacherUserId: string) {
  const [policy, [row]] = await Promise.all([
    getBookingPolicy(),
    db
      .select({
        minNoticeMinutes: teacherProfiles.minNoticeMinutes,
        minCommitmentLessons: teacherProfiles.minCommitmentLessons,
      })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, teacherUserId))
      .limit(1),
  ]);
  return {
    ...bookingNoticeView(policy.minNoticeMinutes, row?.minNoticeMinutes),
    commitment: bookingCommitmentView(
      policy.minCommitmentLessons,
      row?.minCommitmentLessons,
    ),
    policy,
  };
}

export function assertBookingMinNotice(startsAt: Date, minNoticeMinutes: number) {
  if (minNoticeMinutes <= 0) {
    return;
  }
  if (startsAt.getTime() < Date.now() + minNoticeMinutes * 60_000) {
    throw new ApiError(
      422,
      "VALIDATION",
      `Book at least ${formatNoticeDuration(minNoticeMinutes)} ahead`,
    );
  }
}

async function countryTimeZone(iso2?: string | null) {
  if (!iso2) {
    return null;
  }
  const [country] = await db
    .select({ defaultTimezone: countries.defaultTimezone })
    .from(countries)
    .where(eq(countries.iso2, iso2))
    .limit(1);
  return normalizeTimezone(country?.defaultTimezone);
}

async function storedUserTimeZone(userId?: string | null) {
  if (!userId) {
    return null;
  }
  const [row] = await db
    .select({
      timezone: users.timezone,
      country: users.country,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return normalizeTimezone(row?.timezone) ?? (await countryTimeZone(row?.country));
}

export async function readTimeZoneCookie() {
  try {
    const store = await cookies();
    return normalizeTimezone(store.get(TIMEZONE_COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

export async function resolveScheduleTimeZone(userId?: string | null) {
  return (await storedUserTimeZone(userId)) ?? DEFAULT_TIMEZONE;
}

export async function resolveDisplayTimeZone(
  userId?: string | null,
  fallback?: string | null,
) {
  const explicit = normalizeTimezone(fallback);
  if (explicit) {
    return explicit;
  }
  return (await readTimeZoneCookie()) ?? (await resolveScheduleTimeZone(userId));
}

export async function resolveUserTimeZone(userId?: string | null, fallback?: string | null) {
  return resolveDisplayTimeZone(userId, fallback);
}

export async function resolveUserTimeZones(userIds: string[]) {
  const unique = [...new Set(userIds.filter(Boolean))];
  const zones = new Map<string, string>();
  if (!unique.length) {
    return zones;
  }
  const rows = await db
    .select({
      id: users.id,
      timezone: users.timezone,
      country: users.country,
    })
    .from(users)
    .where(inArray(users.id, unique));
  const missingCountries = [
    ...new Set(
      rows
        .filter((row) => !normalizeTimezone(row.timezone) && row.country)
        .map((row) => row.country as string),
    ),
  ];
  const countryRows = missingCountries.length
    ? await db
        .select({
          iso2: countries.iso2,
          defaultTimezone: countries.defaultTimezone,
        })
        .from(countries)
        .where(inArray(countries.iso2, missingCountries))
    : [];
  const countryMap = new Map(
    countryRows.map((row) => [row.iso2, normalizeTimezone(row.defaultTimezone)]),
  );
  for (const row of rows) {
    zones.set(
      row.id,
      normalizeTimezone(row.timezone) ??
        countryMap.get(row.country ?? "") ??
        DEFAULT_TIMEZONE,
    );
  }
  return zones;
}

export async function setPreferredTimeZone(
  value: string,
  actor: { userId: string; roleKey: string } | null,
  persist?: boolean,
) {
  const zone = normalizeTimezone(value);
  if (!zone) {
    throw new ApiError(422, "VALIDATION", "Choose a valid timezone");
  }
  if (actor) {
    const [row] = await db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    const shouldPersist =
      persist === true || (persist !== false && !normalizeTimezone(row?.timezone));
    if (shouldPersist) {
      await db.update(users).set({ timezone: zone }).where(eq(users.id, actor.userId));
    }
  }
  return {
    timeZone: zone,
    timezones: timezoneOptions(zone),
  };
}
