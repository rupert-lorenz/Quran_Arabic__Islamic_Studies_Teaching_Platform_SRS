import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { teacherAvailability, teacherProfiles, users } from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { normalizeTimezone, timezoneOptions } from "@/lib/geo";
import { availabilityDate, eachIsoDate, formatHm, isoDateWeekday, parseHm } from "@/lib/timezone";
import {
  ALL_DAY_END_MINUTE,
  MAX_BLOCKED_AVAILABILITY_DAYS,
  MAX_INDIVIDUAL_AVAILABILITY_DAYS,
  alignSingleWeekdayToStartDate,
  applySingleWeekdayAlignment,
  formatNoticeDuration,
  isAllDayWindow,
  sortedWeekdays,
  weekdayLabel,
} from "@/lib/booking";
import { requireApprovedTeacherProfile } from "@/server/teacher/profile";
import { getBookingPolicy, bookingCommitmentView, bookingNoticeView, resolveScheduleTimeZone } from "./policy";
import type { UpdateAvailabilityInput } from "./schemas";

function parseWindow(startTime: string, endTime: string) {
  const startMinute = parseHm(startTime);
  const endMinute = parseHm(endTime);
  if (startMinute == null || endMinute == null) {
    throw new ApiError(422, "VALIDATION", "Use 24-hour times such as 09:30");
  }
  if (startMinute >= endMinute) {
    throw new ApiError(422, "VALIDATION", "End time must be after start time");
  }
  return { startMinute, endMinute };
}

function resolveWeekdays(input: { weekday?: number; weekdays?: number[] }) {
  const unique = sortedWeekdays([
    ...(input.weekdays ?? []),
    ...(input.weekday == null ? [] : [input.weekday]),
  ]);
  if (!unique.length) {
    throw new ApiError(422, "VALIDATION", "Choose at least one weekday");
  }
  return unique;
}

function resolveRepeatingWeekdays(input: {
  weekday?: number;
  weekdays?: number[];
  startsOn?: string | null;
}) {
  return alignSingleWeekdayToStartDate(resolveWeekdays(input), input.startsOn);
}

async function persistAlignedWeekdays(
  rows: (typeof teacherAvailability.$inferSelect)[],
) {
  const aligned = applySingleWeekdayAlignment(rows);
  const stale = aligned.filter((row) => {
    const original = rows.find((candidate) => candidate.id === row.id);
    return original != null && original.weekday !== row.weekday;
  });
  if (stale.length) {
    await Promise.all(
      stale.map((row) =>
        db
          .update(teacherAvailability)
          .set({ weekday: row.weekday })
          .where(eq(teacherAvailability.id, row.id)),
      ),
    );
  }
  return aligned;
}

export async function loadTeacherAvailabilityRows(teacherUserId: string) {
  const rows = await db
    .select()
    .from(teacherAvailability)
    .where(eq(teacherAvailability.teacherUserId, teacherUserId))
    .orderBy(
      asc(teacherAvailability.kind),
      asc(teacherAvailability.weekday),
      asc(teacherAvailability.localDate),
      asc(teacherAvailability.startMinute),
    );
  return persistWeeklyReplacementHours(await persistAlignedWeekdays(rows));
}

async function persistWeeklyReplacementHours(
  rows: (typeof teacherAvailability.$inferSelect)[],
) {
  const healed = rows.map((row) => {
    if (row.kind !== "extra" || !row.replacesRecurring) {
      return row;
    }
    const startsOn = availabilityDate(row.startsOn) ?? availabilityDate(row.localDate);
    if (!startsOn) {
      return row;
    }
    const weekday = isoDateWeekday(startsOn);
    if (
      row.weekday === weekday &&
      !row.localDate &&
      availabilityDate(row.startsOn) === startsOn
    ) {
      return row;
    }
    return { ...row, weekday, startsOn, localDate: null };
  });
  const stale = healed.filter((row, index) => {
    const original = rows[index];
    return (
      original != null &&
      (original.weekday !== row.weekday ||
        availabilityDate(original.startsOn) !== availabilityDate(row.startsOn) ||
        availabilityDate(original.localDate) !== availabilityDate(row.localDate))
    );
  });
  if (stale.length) {
    await Promise.all(
      stale.map((row) =>
        db
          .update(teacherAvailability)
          .set({
            weekday: row.weekday,
            startsOn: availabilityDate(row.startsOn),
            localDate: null,
          })
          .where(eq(teacherAvailability.id, row.id)),
      ),
    );
  }
  return healed;
}

function mapWindow(row: typeof teacherAvailability.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    weekday: row.weekday,
    weekdayLabel: row.weekday == null ? null : weekdayLabel(row.weekday),
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    startTime: formatHm(row.startMinute),
    endTime: formatHm(row.endMinute),
    localDate: availabilityDate(row.localDate),
    recurrenceGroupId: row.recurrenceGroupId ?? row.id,
    startsOn: availabilityDate(row.startsOn),
    endsOn: availabilityDate(row.endsOn),
    weekInterval: row.weekInterval || 1,
    replacesRecurring: Boolean(row.replacesRecurring),
    allDay: isAllDayWindow(row.startMinute, row.endMinute),
    timezone: row.timezone,
    note: row.note,
  };
}

export async function listTeacherAvailability(teacherUserId: string) {
  const timezone = await resolveScheduleTimeZone(teacherUserId);
  const [rows, policy, [profile]] = await Promise.all([
    loadTeacherAvailabilityRows(teacherUserId),
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
    timezone,
    timezones: timezoneOptions(timezone),
    windows: rows.map(mapWindow),
    notice: bookingNoticeView(policy.minNoticeMinutes, profile?.minNoticeMinutes),
    commitment: bookingCommitmentView(
      policy.minCommitmentLessons,
      profile?.minCommitmentLessons,
    ),
  };
}

export async function setTeacherAvailabilitySettings(
  actor: ApiActor,
  input: {
    timezone?: string;
    minNoticeMinutes?: number | null;
    minCommitmentLessons?: number | null;
  },
  ip: string,
) {
  await requireApprovedTeacherProfile(actor.userId);
  if (input.timezone) {
    const zone = normalizeTimezone(input.timezone);
    if (!zone) {
      throw new ApiError(422, "VALIDATION", "Choose a valid timezone");
    }
    await db.update(users).set({ timezone: zone }).where(eq(users.id, actor.userId));
    await db
      .update(teacherAvailability)
      .set({ timezone: zone })
      .where(eq(teacherAvailability.teacherUserId, actor.userId));
    await writeAuditLog({
      actor,
      action: "bookings.availability_timezone",
      entityType: "teacher_availability",
      entityId: actor.userId,
      ipAddress: ip,
      metadata: { timezone: zone },
    });
  }
  if (input.minNoticeMinutes !== undefined) {
    const policy = await getBookingPolicy();
    const minutes = input.minNoticeMinutes;
    if (minutes != null && minutes < policy.minNoticeMinutes) {
      throw new ApiError(
        422,
        "VALIDATION",
        `Choose a notice of at least ${formatNoticeDuration(policy.minNoticeMinutes)}`,
      );
    }
    await db
      .update(teacherProfiles)
      .set({ minNoticeMinutes: minutes })
      .where(eq(teacherProfiles.userId, actor.userId));
    await writeAuditLog({
      actor,
      action: "bookings.availability_notice",
      entityType: "teacher_availability",
      entityId: actor.userId,
      ipAddress: ip,
      metadata: { minNoticeMinutes: minutes, platformMinutes: policy.minNoticeMinutes },
    });
  }
  if (input.minCommitmentLessons !== undefined) {
    const policy = await getBookingPolicy();
    const lessons = input.minCommitmentLessons;
    if (lessons != null && lessons < policy.minCommitmentLessons) {
      throw new ApiError(
        422,
        "VALIDATION",
        `Choose at least ${policy.minCommitmentLessons} lessons`,
      );
    }
    await db
      .update(teacherProfiles)
      .set({ minCommitmentLessons: lessons })
      .where(eq(teacherProfiles.userId, actor.userId));
    await writeAuditLog({
      actor,
      action: "bookings.minimum_commitment",
      entityType: "teacher_availability",
      entityId: actor.userId,
      ipAddress: ip,
      metadata: {
        minCommitmentLessons: lessons,
        platformLessons: policy.minCommitmentLessons,
      },
    });
  }
  return listTeacherAvailability(actor.userId);
}

export async function addRecurringAvailability(
  actor: ApiActor,
  input: {
    kind?: "recurring" | "break";
    weekday?: number;
    weekdays?: number[];
    startTime: string;
    endTime: string;
    startsOn?: string;
    endsOn?: string;
    weekInterval?: number;
    note?: string;
  },
  ip: string,
) {
  await requireApprovedTeacherProfile(actor.userId);
  const timezone = await resolveScheduleTimeZone(actor.userId);
  const window = parseWindow(input.startTime, input.endTime);
  const weekdays = resolveRepeatingWeekdays(input);
  const weekInterval = input.weekInterval ?? 1;
  const kind = input.kind ?? "recurring";
  const groupId = randomUUID();
  const rows = await db
    .insert(teacherAvailability)
    .values(
      weekdays.map((weekday) => ({
        teacherUserId: actor.userId,
        kind,
        weekday,
        ...window,
        localDate: null,
        recurrenceGroupId: groupId,
        startsOn: input.startsOn || null,
        endsOn: input.endsOn || null,
        weekInterval,
        replacesRecurring: false,
        timezone,
        note: input.note?.trim() || null,
      })),
    )
    .returning();
  await writeAuditLog({
    actor,
    action: "bookings.availability_added",
    entityType: "teacher_availability",
    entityId: rows[0]?.id,
    ipAddress: ip,
    metadata: {
      kind,
      weekdays,
      weekInterval,
      startsOn: input.startsOn || null,
      endsOn: input.endsOn || null,
    },
  });
  return listTeacherAvailability(actor.userId);
}

export async function addDatedAvailability(
  actor: ApiActor,
  input: {
    kind: "extra" | "block";
    localDate: string;
    untilDate?: string;
    startTime?: string;
    endTime?: string;
    replacesRecurring?: boolean;
    allDay?: boolean;
    note?: string;
  },
  ip: string,
) {
  await requireApprovedTeacherProfile(actor.userId);
  const timezone = await resolveScheduleTimeZone(actor.userId);
  const window =
    input.kind === "block" && input.allDay
      ? { startMinute: 0, endMinute: ALL_DAY_END_MINUTE }
      : parseWindow(input.startTime ?? "", input.endTime ?? "");
  const untilDate = input.untilDate || input.localDate;
  const replaceWeekly =
    input.kind === "extra" && Boolean(input.replacesRecurring);
  const dates = replaceWeekly ? [input.localDate] : eachIsoDate(input.localDate, untilDate);
  const maxDays =
    input.kind === "block" ? MAX_BLOCKED_AVAILABILITY_DAYS : MAX_INDIVIDUAL_AVAILABILITY_DAYS;
  if (!replaceWeekly && dates.length > maxDays) {
    throw new ApiError(422, "VALIDATION", `Choose at most ${maxDays} dates at a time`);
  }
  const groupId = input.kind === "block" ? randomUUID() : null;
  const weekday = replaceWeekly ? isoDateWeekday(input.localDate) : null;
  const rows = await db
    .insert(teacherAvailability)
    .values(
      dates.map((localDate) => ({
        teacherUserId: actor.userId,
        kind: input.kind,
        weekday,
        ...window,
        localDate: replaceWeekly ? null : localDate,
        recurrenceGroupId: groupId,
        startsOn: replaceWeekly ? input.localDate : null,
        endsOn:
          replaceWeekly && input.untilDate && input.untilDate !== input.localDate
            ? input.untilDate
            : null,
        weekInterval: 1,
        replacesRecurring: replaceWeekly,
        timezone,
        note: input.note?.trim() || null,
      })),
    )
    .returning();
  await writeAuditLog({
    actor,
    action: "bookings.availability_added",
    entityType: "teacher_availability",
    entityId: rows[0]?.id,
    ipAddress: ip,
    metadata: {
      kind: input.kind,
      localDate: input.localDate,
      untilDate: untilDate === input.localDate ? null : untilDate,
      count: dates.length,
      allDay: Boolean(input.allDay),
      replacesRecurring: Boolean(input.replacesRecurring),
    },
  });
  return listTeacherAvailability(actor.userId);
}

async function loadOwnedWindow(actor: ApiActor, id: string) {
  const [row] = await db
    .select()
    .from(teacherAvailability)
    .where(
      and(
        eq(teacherAvailability.id, id),
        eq(teacherAvailability.teacherUserId, actor.userId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Availability window not found");
  }
  return row;
}

async function loadGroupWindows(
  teacherUserId: string,
  row: typeof teacherAvailability.$inferSelect,
) {
  if (!row.recurrenceGroupId) {
    return [row];
  }
  return db
    .select()
    .from(teacherAvailability)
    .where(
      and(
        eq(teacherAvailability.teacherUserId, teacherUserId),
        or(
          eq(teacherAvailability.recurrenceGroupId, row.recurrenceGroupId),
          eq(teacherAvailability.id, row.recurrenceGroupId),
        ),
      ),
    );
}

export async function updateAvailability(
  actor: ApiActor,
  id: string,
  input: UpdateAvailabilityInput,
  ip: string,
) {
  await requireApprovedTeacherProfile(actor.userId);
  const current = await loadOwnedWindow(actor, id);
  if (current.kind === "extra") {
    const startTime = input.startTime ?? formatHm(current.startMinute);
    const endTime = input.endTime ?? formatHm(current.endMinute);
    const window = parseWindow(startTime, endTime);
    const localDate =
      input.localDate === undefined
        ? availabilityDate(current.localDate) ?? availabilityDate(current.startsOn)
        : input.localDate;
    if (!localDate) {
      throw new ApiError(422, "VALIDATION", "Choose a calendar date");
    }
    const replacesRecurring = input.replacesRecurring ?? current.replacesRecurring;
    const endsOn =
      input.untilDate === undefined
        ? availabilityDate(current.endsOn)
        : input.untilDate;
    await db
      .update(teacherAvailability)
      .set({
        ...window,
        weekday: replacesRecurring ? isoDateWeekday(localDate) : null,
        localDate: replacesRecurring ? null : localDate,
        startsOn: replacesRecurring ? localDate : null,
        endsOn: replacesRecurring ? endsOn : null,
        note: input.note === undefined ? current.note : input.note?.trim() || null,
        replacesRecurring,
      })
      .where(eq(teacherAvailability.id, current.id));
    await writeAuditLog({
      actor,
      action: "bookings.availability_updated",
      entityType: "teacher_availability",
      entityId: current.id,
      ipAddress: ip,
      metadata: {
        kind: current.kind,
        localDate,
        replacesRecurring,
      },
    });
    return listTeacherAvailability(actor.userId);
  }

  if (current.kind === "block") {
    const members = await loadGroupWindows(actor.userId, current);
    const groupId = current.recurrenceGroupId ?? randomUUID();
    const allDay =
      input.allDay ?? isAllDayWindow(current.startMinute, current.endMinute);
    const window = allDay
      ? { startMinute: 0, endMinute: ALL_DAY_END_MINUTE }
      : parseWindow(
          input.startTime ?? formatHm(current.startMinute),
          input.endTime ?? formatHm(current.endMinute),
        );
    const note = input.note === undefined ? current.note : input.note?.trim() || null;
    const existingDates = members
      .map((row) => availabilityDate(row.localDate))
      .filter((value): value is string => Boolean(value))
      .sort();
    const startDate =
      input.localDate === undefined ? existingDates[0] : input.localDate;
    const endDate =
      input.untilDate === undefined
        ? (existingDates[existingDates.length - 1] ?? startDate)
        : input.untilDate;
    if (!startDate) {
      throw new ApiError(422, "VALIDATION", "Choose a calendar date");
    }
    const dates = eachIsoDate(startDate, endDate || startDate);
    if (dates.length > MAX_BLOCKED_AVAILABILITY_DAYS) {
      throw new ApiError(
        422,
        "VALIDATION",
        `Choose at most ${MAX_BLOCKED_AVAILABILITY_DAYS} dates at a time`,
      );
    }
    const existingByDate = new Map(
      members.flatMap((row) => {
        const date = availabilityDate(row.localDate);
        return date ? [[date, row] as const] : [];
      }),
    );
    const keepIds: string[] = [];
    const timezone = await resolveScheduleTimeZone(actor.userId);
    for (const localDate of dates) {
      const existing = existingByDate.get(localDate);
      if (existing) {
        await db
          .update(teacherAvailability)
          .set({
            ...window,
            recurrenceGroupId: groupId,
            note,
            timezone,
          })
          .where(eq(teacherAvailability.id, existing.id));
        keepIds.push(existing.id);
      } else {
        const [created] = await db
          .insert(teacherAvailability)
          .values({
            teacherUserId: actor.userId,
            kind: "block",
            weekday: null,
            ...window,
            localDate,
            recurrenceGroupId: groupId,
            startsOn: null,
            endsOn: null,
            weekInterval: 1,
            replacesRecurring: false,
            timezone,
            note,
          })
          .returning({ id: teacherAvailability.id });
        if (created) {
          keepIds.push(created.id);
        }
      }
    }
    const removeIds = members
      .map((row) => row.id)
      .filter((memberId) => !keepIds.includes(memberId));
    if (removeIds.length) {
      await db.delete(teacherAvailability).where(inArray(teacherAvailability.id, removeIds));
    }
    await writeAuditLog({
      actor,
      action: "bookings.availability_updated",
      entityType: "teacher_availability",
      entityId: keepIds[0] ?? id,
      ipAddress: ip,
      metadata: { kind: "block", dates, allDay },
    });
    return listTeacherAvailability(actor.userId);
  }

  const timezone = await resolveScheduleTimeZone(actor.userId);
  const members = await loadGroupWindows(actor.userId, current);
  const groupId = current.recurrenceGroupId ?? randomUUID();
  const startTime = input.startTime ?? formatHm(current.startMinute);
  const endTime = input.endTime ?? formatHm(current.endMinute);
  const window = parseWindow(startTime, endTime);
  const startsOn =
    input.startsOn === undefined ? availabilityDate(current.startsOn) : input.startsOn;
  const endsOn =
    input.endsOn === undefined ? availabilityDate(current.endsOn) : input.endsOn;
  const weekdays = alignSingleWeekdayToStartDate(
    input.weekdays?.length
      ? resolveWeekdays({ weekdays: input.weekdays })
      : resolveWeekdays({
          weekdays: members
            .map((row) => row.weekday)
            .filter((value): value is number => value != null),
        }),
    startsOn,
  );
  const weekInterval = input.weekInterval ?? current.weekInterval ?? 1;
  const note =
    input.note === undefined ? current.note : input.note?.trim() || null;

  if (weekInterval > 1 && !startsOn) {
    throw new ApiError(422, "VALIDATION", "Choose a start date for fortnightly schedules");
  }

  const existingByWeekday = new Map(
    members
      .filter((row) => row.weekday != null)
      .map((row) => [row.weekday as number, row]),
  );
  const keepIds: string[] = [];

  for (const weekday of weekdays) {
    const existing = existingByWeekday.get(weekday);
    if (existing) {
      await db
        .update(teacherAvailability)
        .set({
          ...window,
          recurrenceGroupId: groupId,
          startsOn,
          endsOn,
          weekInterval,
          timezone,
          note,
        })
        .where(eq(teacherAvailability.id, existing.id));
      keepIds.push(existing.id);
    } else {
      const [created] = await db
        .insert(teacherAvailability)
        .values({
          teacherUserId: actor.userId,
          kind: current.kind,
          weekday,
          ...window,
          localDate: null,
          recurrenceGroupId: groupId,
          startsOn,
          endsOn,
          weekInterval,
          replacesRecurring: false,
          timezone,
          note,
        })
        .returning({ id: teacherAvailability.id });
      if (created) {
        keepIds.push(created.id);
      }
    }
  }

  const removeIds = members
    .map((row) => row.id)
    .filter((memberId) => !keepIds.includes(memberId));
  if (removeIds.length) {
    await db
      .delete(teacherAvailability)
      .where(inArray(teacherAvailability.id, removeIds));
  }

  await writeAuditLog({
    actor,
    action: "bookings.availability_updated",
    entityType: "teacher_availability",
    entityId: keepIds[0] ?? id,
    ipAddress: ip,
    metadata: { weekdays, weekInterval, startsOn, endsOn },
  });
  return listTeacherAvailability(actor.userId);
}

export async function removeAvailability(actor: ApiActor, id: string, ip: string) {
  await requireApprovedTeacherProfile(actor.userId);
  await loadOwnedWindow(actor, id);
  await db.delete(teacherAvailability).where(eq(teacherAvailability.id, id));
  await writeAuditLog({
    actor,
    action: "bookings.availability_removed",
    entityType: "teacher_availability",
    entityId: id,
    ipAddress: ip,
  });
  return listTeacherAvailability(actor.userId);
}

export async function removeAvailabilityGroup(actor: ApiActor, id: string, ip: string) {
  await requireApprovedTeacherProfile(actor.userId);
  const current = await loadOwnedWindow(actor, id);
  const members = await loadGroupWindows(actor.userId, current);
  const ids = members.map((row) => row.id);
  await db.delete(teacherAvailability).where(inArray(teacherAvailability.id, ids));
  await writeAuditLog({
    actor,
    action: "bookings.availability_removed",
    entityType: "teacher_availability",
    entityId: id,
    ipAddress: ip,
    metadata: { group: true, count: ids.length },
  });
  return listTeacherAvailability(actor.userId);
}
