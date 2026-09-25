import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, groupLessons, teacherAvailability, teacherProfiles, teacherSubjects } from "@/db/schema";
import { BOOKING_HORIZON_DAYS, MAX_GROUP_CLASS_DAYS, availabilityAppliesOnDate, effectiveMinCommitmentLessons, effectiveMinNoticeMinutes, isSupportedLessonDuration, lessonDurationOptions, openWindowsForDate, rangesOverlap } from "@/lib/booking";
import { ApiError } from "@/server/api/errors";
import {
  addCalendarDays,
  availabilityDate,
  eachIsoDate,
  formatInTimeZone,
  isoDateDiffDays,
  parseIsoDate,
  splitMinute,
  zonedLocalToUtc,
  zonedWeekday,
  zonedYmd,
} from "@/lib/timezone";
import { loadTeacherAvailabilityRows } from "./availability";
import { getBookingPolicy, resolveDisplayTimeZone, resolveScheduleTimeZone } from "./policy";

type WindowRow = typeof teacherAvailability.$inferSelect;

function windowOnDate(row: WindowRow, isoDate: string, weekday: number) {
  return availabilityAppliesOnDate(
    {
      kind: row.kind,
      weekday: row.weekday,
      localDate: availabilityDate(row.localDate),
      startsOn: availabilityDate(row.startsOn),
      endsOn: availabilityDate(row.endsOn),
      weekInterval: row.weekInterval,
    },
    isoDate,
    weekday,
  );
}

export async function listOpenBookings(teacherUserId: string, from: Date, to: Date) {
  return db
    .select({
      id: bookings.id,
      teacherUserId: bookings.teacherUserId,
      studentUserId: bookings.studentUserId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.teacherUserId, teacherUserId),
        inArray(bookings.status, ["confirmed", "completed"]),
        gte(bookings.endsAt, from),
        lt(bookings.startsAt, to),
      ),
    );
}

async function listOpenGroupLessons(teacherUserId: string, from: Date, to: Date) {
  return db
    .select({
      id: groupLessons.id,
      startsAt: groupLessons.startsAt,
      endsAt: groupLessons.endsAt,
    })
    .from(groupLessons)
    .where(
      and(
        eq(groupLessons.teacherUserId, teacherUserId),
        eq(groupLessons.status, "published"),
        gte(groupLessons.endsAt, from),
        lt(groupLessons.startsAt, to),
      ),
    );
}

export async function listTeacherSlots(
  teacherUserId: string,
  input: {
    from?: string;
    to?: string;
    durationMinutes?: number;
    timeZone?: string;
    viewerUserId?: string | null;
    ignoreMinNotice?: boolean;
    ignoreBookingIds?: string[];
  },
) {
  const [policy, timezone, viewerTimeZone, windows, subjects, [teacher]] = await Promise.all([
    getBookingPolicy(),
    resolveScheduleTimeZone(teacherUserId),
    resolveDisplayTimeZone(input.viewerUserId, input.timeZone),
    loadTeacherAvailabilityRows(teacherUserId),
    db
      .select({ slug: teacherSubjects.subjectSlug })
      .from(teacherSubjects)
      .where(eq(teacherSubjects.teacherUserId, teacherUserId)),
    db
      .select({
        minNoticeMinutes: teacherProfiles.minNoticeMinutes,
        minCommitmentLessons: teacherProfiles.minCommitmentLessons,
      })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, teacherUserId))
      .limit(1),
  ]);

  const duration = input.durationMinutes ?? policy.lessonDurationMinutes;
  if (!isSupportedLessonDuration(duration, policy.lessonDurationMinutes)) {
    throw new ApiError(422, "VALIDATION", "Choose a supported lesson length");
  }
  const now = new Date();
  const fromIso =
    input.from?.slice(0, 10) || zonedYmd(now, viewerTimeZone).iso;
  let toIso =
    input.to?.slice(0, 10) || addCalendarDays(fromIso, BOOKING_HORIZON_DAYS);
  if (toIso < fromIso) {
    toIso = fromIso;
  }
  if (isoDateDiffDays(fromIso, toIso) > MAX_GROUP_CLASS_DAYS) {
    toIso = addCalendarDays(fromIso, MAX_GROUP_CLASS_DAYS);
  }
  const fromParts = parseIsoDate(fromIso);
  const toParts = parseIsoDate(addCalendarDays(toIso, 1));
  const rangeStart = zonedLocalToUtc(
    timezone,
    fromParts.year,
    fromParts.month,
    fromParts.day,
    0,
    0,
  );
  const rangeEnd = zonedLocalToUtc(
    timezone,
    toParts.year,
    toParts.month,
    toParts.day,
    0,
    0,
  );
  const [allOccupied, occupiedGroups] = await Promise.all([
    listOpenBookings(teacherUserId, rangeStart, rangeEnd),
    listOpenGroupLessons(teacherUserId, rangeStart, rangeEnd),
  ]);
  const ignoredIds = new Set(input.ignoreBookingIds ?? []);
  const occupied = allOccupied.filter((row) => !ignoredIds.has(row.id));
  const minNoticeMinutes = effectiveMinNoticeMinutes(
    policy.minNoticeMinutes,
    teacher?.minNoticeMinutes,
  );
  const earliest = input.ignoreMinNotice
    ? now
    : new Date(now.getTime() + minNoticeMinutes * 60_000);
  const slots: {
    startsAt: string;
    endsAt: string;
    label: string;
    teacherLabel: string | null;
    durationMinutes: number;
  }[] = [];

  for (const isoDate of eachIsoDate(fromIso, toIso)) {
    const { year, month, day } = parseIsoDate(isoDate);
    const noon = zonedLocalToUtc(timezone, year, month, day, 12, 0);
    const weekday = zonedWeekday(noon, timezone);
    const matching = windows.filter((row) => windowOnDate(row, isoDate, weekday));
    const { open: dayWindows, blocks: dayBlocks } = openWindowsForDate(matching);

    for (const window of dayWindows) {
      for (
        let startMinute = window.startMinute;
        startMinute + duration <= window.endMinute;
        startMinute += duration
      ) {
        const startClock = splitMinute(startMinute);
        const endClock = splitMinute(startMinute + duration);
        const startsAt = zonedLocalToUtc(
          timezone,
          year,
          month,
          day,
          startClock.hour,
          startClock.minute,
        );
        const endsAt = zonedLocalToUtc(
          timezone,
          year,
          month,
          day,
          endClock.hour,
          endClock.minute,
        );
        if (startsAt < earliest) {
          continue;
        }
        const blocked = dayBlocks.some((block) =>
          rangesOverlap(
            startsAt,
            endsAt,
            zonedLocalToUtc(
              timezone,
              year,
              month,
              day,
              splitMinute(block.startMinute).hour,
              splitMinute(block.startMinute).minute,
            ),
            zonedLocalToUtc(
              timezone,
              year,
              month,
              day,
              splitMinute(block.endMinute).hour,
              splitMinute(block.endMinute).minute,
            ),
          ),
        );
        if (blocked) {
          continue;
        }
        const taken = [...occupied, ...occupiedGroups].some((booking) =>
          rangesOverlap(startsAt, endsAt, booking.startsAt, booking.endsAt),
        );
        if (taken) {
          continue;
        }
        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          durationMinutes: duration,
          label: formatInTimeZone(startsAt, viewerTimeZone),
          teacherLabel:
            timezone === viewerTimeZone ? null : formatInTimeZone(startsAt, timezone),
        });
      }
    }
  }

  return {
    timezone,
    viewerTimeZone,
    format: "one_to_one" as const,
    durationMinutes: duration,
    lessonDurationMinutes: policy.lessonDurationMinutes,
    durationOptions: lessonDurationOptions(policy.lessonDurationMinutes),
    minNoticeMinutes,
    cancelNoticeMinutes: policy.cancelNoticeMinutes,
    minCommitmentLessons: effectiveMinCommitmentLessons(
      policy.minCommitmentLessons,
      teacher?.minCommitmentLessons,
    ),
    trialDurationMinutes: policy.trialDurationMinutes,
    trialPricePercent: policy.trialPricePercent,
    subjectSlugs: subjects.map((item) => item.slug),
    slots,
  };
}
