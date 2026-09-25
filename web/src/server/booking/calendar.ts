import { availabilityAppliesOnDate, isAllDayWindow, openWindowsForDate, publicGroupClassHref, weekdayLabel } from "@/lib/booking";
import type {
  LessonCalendarEvent,
  LessonCalendarRole,
  LessonCalendarState,
  TeacherCalendarDay,
  TeacherCalendarEvent,
  TeacherCalendarState,
} from "@/lib/booking";
import {
  addCalendarDays,
  eachIsoDate,
  formatHm,
  formatIsoDateLabel,
  parseIsoDate,
  startOfIsoWeek,
  zonedHms,
  zonedLocalToUtc,
  zonedWeekday,
  zonedYmd,
} from "@/lib/timezone";
import type { ApiActor } from "@/server/api/auth";
import { timezoneOptions } from "@/lib/geo";
import { listTeacherAvailability } from "./availability";
import { getBookingPolicy, resolveDisplayTimeZone, resolveScheduleTimeZone } from "./policy";
import { listActorBookingsBetween, listTeacherBookingsBetween } from "./service";
import { listActorGroupLessonsBetween } from "./group-lessons";
import { listTeacherSlots } from "./slots";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function availabilityWindowCopy(window: {
  kind: string;
  note?: string | null;
  weekInterval?: number | null;
  replacesRecurring?: boolean | null;
  startsOn?: string | null;
  endsOn?: string | null;
}) {
  const note = window.note?.trim() || "";
  const fallback =
    window.kind === "recurring"
      ? window.weekInterval && window.weekInterval > 1
        ? `Every ${window.weekInterval} weeks`
        : "Working hours"
      : window.kind === "extra"
        ? "Individual hours"
        : window.kind === "break"
          ? "Break"
          : "Blocked";
  const detail = [
    note ? fallback : null,
    window.kind === "extra" && window.replacesRecurring
      ? "Replaces weekly hours"
      : null,
    window.kind === "break" ? "Closed for bookings" : null,
    window.startsOn ? `from ${formatIsoDateLabel(window.startsOn)}` : null,
    window.endsOn ? `until ${formatIsoDateLabel(window.endsOn)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { title: note || fallback, detail: detail || null };
}

function weekLabel(weekStart: string, weekEnd: string) {
  const start = parseIsoDate(weekStart);
  const end = parseIsoDate(weekEnd);
  const startMonth = MONTHS[start.month - 1];
  const endMonth = MONTHS[end.month - 1];
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}–${end.day} ${startMonth} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${startMonth} – ${end.day} ${endMonth} ${start.year}`;
  }
  return `${start.day} ${startMonth} ${start.year} – ${end.day} ${endMonth} ${end.year}`;
}

function minuteFromInstant(instant: Date, timeZone: string) {
  const clock = zonedHms(instant, timeZone);
  return clock.hour * 60 + clock.minute;
}

export async function getTeacherCalendar(
  teacherUserId: string,
  from?: string,
): Promise<TeacherCalendarState> {
  const timezone = await resolveScheduleTimeZone(teacherUserId);
  const todayIso = zonedYmd(new Date(), timezone).iso;
  const weekStart = startOfIsoWeek(from || todayIso);
  const weekEnd = addCalendarDays(weekStart, 6);
  const rangeStartParts = parseIsoDate(weekStart);
  const rangeEndParts = parseIsoDate(addCalendarDays(weekEnd, 1));
  const rangeStart = zonedLocalToUtc(
    timezone,
    rangeStartParts.year,
    rangeStartParts.month,
    rangeStartParts.day,
    0,
    0,
  );
  const rangeEnd = zonedLocalToUtc(
    timezone,
    rangeEndParts.year,
    rangeEndParts.month,
    rangeEndParts.day,
    0,
    0,
  );

  const [availability, policy, bookings, groups, slotData] = await Promise.all([
    listTeacherAvailability(teacherUserId),
    getBookingPolicy(),
    listTeacherBookingsBetween(teacherUserId, rangeStart, rangeEnd, timezone),
    listActorGroupLessonsBetween(
      { userId: teacherUserId, roleKey: "teacher", permissions: [] },
      rangeStart,
      rangeEnd,
      timezone,
    ),
    listTeacherSlots(teacherUserId, {
      from: weekStart,
      to: weekEnd,
      timeZone: timezone,
      viewerUserId: teacherUserId,
    }),
  ]);

  const nowMinute = minuteFromInstant(new Date(), timezone);
  let hourStart = 7 * 60;
  let hourEnd = 21 * 60;

  const days = eachIsoDate(weekStart, weekEnd).map((isoDate) => {
    const parts = parseIsoDate(isoDate);
    const noon = zonedLocalToUtc(timezone, parts.year, parts.month, parts.day, 12, 0);
    const weekday = zonedWeekday(noon, timezone);
    const events: TeacherCalendarEvent[] = [];
    const holidays: TeacherCalendarDay["holidays"] = [];

    const matching = availability.windows.filter((window) =>
      availabilityAppliesOnDate(window, isoDate, weekday),
    );
    const { open, blocks } = openWindowsForDate(matching);
    for (const window of [...open, ...blocks]) {
      const allDay = window.kind === "block" && isAllDayWindow(window.startMinute, window.endMinute);
      if (allDay) {
        holidays.push({
          id: `holiday:${window.id}:${isoDate}`,
          windowId: window.id,
          title: window.note?.trim() || "Holiday",
          detail: "All day · no bookings",
        });
        continue;
      }
      const copy = availabilityWindowCopy(window);
      events.push({
        id: `window:${window.id}:${isoDate}`,
        type: window.kind === "recurring" ? "hours" : window.kind,
        title: copy.title,
        detail: copy.detail,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        startTime: window.startTime,
        endTime: window.endTime,
        windowId: window.id,
        allDay,
      });
    }

    for (const booking of bookings) {
      if (zonedYmd(new Date(booking.startsAt), timezone).iso !== isoDate) {
        continue;
      }
      const startMinute = minuteFromInstant(new Date(booking.startsAt), timezone);
      let endMinute = minuteFromInstant(new Date(booking.endsAt), timezone);
      if (endMinute <= startMinute) {
        endMinute = Math.min(24 * 60, startMinute + booking.durationMinutes);
      }
      events.push({
        id: `booking:${booking.id}`,
        type: "booking",
        title: booking.studentName,
        detail: [booking.subjectName, booking.statusLabel].filter(Boolean).join(" · "),
        startMinute,
        endMinute,
        startTime: formatHm(startMinute),
        endTime: formatHm(endMinute),
        bookingId: booking.id,
        studentName: booking.studentName,
        status: booking.status,
        href: `/teach/bookings#booking-${booking.id}`,
        classroomHref: booking.classroomHref,
        classroomJoinable: booking.classroomJoinable,
      });
    }

    for (const group of groups) {
      if (zonedYmd(new Date(group.startsAt), timezone).iso !== isoDate) continue;
      const startMinute = minuteFromInstant(new Date(group.startsAt), timezone);
      let endMinute = minuteFromInstant(new Date(group.endsAt), timezone);
      if (endMinute <= startMinute) {
        endMinute = Math.min(24 * 60, startMinute + group.durationMinutes);
      }
      events.push({
        id: `group:${group.id}`,
        type: "group",
        title: group.title,
        detail: [
          group.subjectName,
          `${group.studentPriceFormatted} student`,
          group.teacherPaymentFormatted
            ? `${group.teacherPaymentFormatted} teacher`
            : null,
          `${group.enrolledCount}/${group.capacity} enrolled`,
          group.waitlistCount ? `${group.waitlistCount} waiting` : null,
          `min ${group.minStudents}`,
        ]
          .filter(Boolean)
          .join(" · "),
        startMinute,
        endMinute,
        startTime: formatHm(startMinute),
        endTime: formatHm(endMinute),
        groupLessonId: group.id,
        status: group.status,
        href: `/teach/group-lessons#group-${group.id}`,
        classroomHref: group.classroomHref,
        classroomJoinable: group.classroomJoinable,
      });
    }

    events.sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);

    for (const event of events) {
      hourStart = Math.min(hourStart, Math.max(0, Math.floor(event.startMinute / 60) * 60 - 60));
      hourEnd = Math.max(hourEnd, Math.min(24 * 60, Math.ceil(event.endMinute / 60) * 60 + 60));
    }

    return {
      isoDate,
      weekday,
      weekdayLabel: weekdayLabel(weekday),
      weekdayShort: weekdayLabel(weekday).slice(0, 3),
      dayNumber: parts.day,
      isToday: isoDate === todayIso,
      openSlotCount: slotData.slots.filter(
        (slot) => zonedYmd(new Date(slot.startsAt), timezone).iso === isoDate,
      ).length,
      holidays,
      events,
    };
  });

  if (hourEnd - hourStart < 12 * 60) {
    hourEnd = Math.min(24 * 60, hourStart + 12 * 60);
  }

  return {
    ...availability,
    todayIso,
    weekStart,
    weekEnd,
    prevWeekStart: addCalendarDays(weekStart, -7),
    nextWeekStart: addCalendarDays(weekStart, 7),
    weekLabel: weekLabel(weekStart, weekEnd),
    hourStart,
    hourEnd,
    nowMinute: days.some((day) => day.isToday) ? nowMinute : null,
    lessonDurationMinutes: policy.lessonDurationMinutes,
    summary: {
      booked:
        bookings.filter((row) => row.status === "confirmed" || row.status === "completed").length +
        groups.filter((row) => row.status === "published").length,
      openSlots: slotData.slots.length,
      blocked: days.reduce(
        (count, day) =>
          count +
          day.events.filter((event) => event.type === "block" || event.type === "break")
            .length,
        0,
      ),
      weeklyWindows: availability.windows.filter((row) => row.kind === "recurring").length,
    },
    days,
  };
}

function lessonCalendarRole(roleKey: string): LessonCalendarRole {
  if (roleKey === "parent" || roleKey === "student" || roleKey === "teacher") {
    return roleKey;
  }
  return "staff";
}

function lessonCalendarHref(role: LessonCalendarRole, bookingId: string) {
  const base =
    role === "parent"
      ? "/family/bookings"
      : role === "student"
        ? "/learn/bookings"
        : role === "teacher"
          ? "/teach/bookings"
          : "/staff/bookings";
  return `${base}#booking-${bookingId}`;
}

export async function getLessonCalendar(
  actor: ApiActor,
  from?: string,
  timeZone?: string,
): Promise<LessonCalendarState> {
  const role = lessonCalendarRole(actor.roleKey);
  const timezone = await resolveDisplayTimeZone(actor.userId, timeZone);
  const todayIso = zonedYmd(new Date(), timezone).iso;
  const weekStart = startOfIsoWeek(from || todayIso);
  const weekEnd = addCalendarDays(weekStart, 6);
  const rangeStartParts = parseIsoDate(weekStart);
  const rangeEndParts = parseIsoDate(addCalendarDays(weekEnd, 1));
  const rangeStart = zonedLocalToUtc(
    timezone,
    rangeStartParts.year,
    rangeStartParts.month,
    rangeStartParts.day,
    0,
    0,
  );
  const rangeEnd = zonedLocalToUtc(
    timezone,
    rangeEndParts.year,
    rangeEndParts.month,
    rangeEndParts.day,
    0,
    0,
  );
  const [bookings, groups] = await Promise.all([
    listActorBookingsBetween(actor, rangeStart, rangeEnd, timezone),
    listActorGroupLessonsBetween(actor, rangeStart, rangeEnd, timezone),
  ]);
  const nowMinute = minuteFromInstant(new Date(), timezone);
  let hourStart = 7 * 60;
  let hourEnd = 21 * 60;

  const days = eachIsoDate(weekStart, weekEnd).map((isoDate) => {
    const parts = parseIsoDate(isoDate);
    const noon = zonedLocalToUtc(timezone, parts.year, parts.month, parts.day, 12, 0);
    const weekday = zonedWeekday(noon, timezone);
    const events: LessonCalendarEvent[] = [];

    for (const booking of bookings) {
      if (zonedYmd(new Date(booking.startsAt), timezone).iso !== isoDate) {
        continue;
      }
      const startMinute = minuteFromInstant(new Date(booking.startsAt), timezone);
      let endMinute = minuteFromInstant(new Date(booking.endsAt), timezone);
      if (endMinute <= startMinute) {
        endMinute = Math.min(24 * 60, startMinute + booking.durationMinutes);
      }
      const title =
        role === "student" ? booking.teacherName : booking.studentName;
      const detailBits = [
        role === "student" ? null : booking.teacherName,
        booking.subjectName,
        booking.bookingModeLabel,
        booking.kind === "trial" ? booking.kindLabel : null,
        booking.statusLabel,
      ].filter(Boolean);
      events.push({
        id: `booking:${booking.id}`,
        type: "booking",
        title,
        detail: detailBits.join(" · ") || null,
        startMinute,
        endMinute,
        startTime: formatHm(startMinute),
        endTime: formatHm(endMinute),
        teacherTime:
          booking.teacherTimezone && booking.teacherTimezone !== timezone
            ? formatHm(minuteFromInstant(new Date(booking.startsAt), booking.teacherTimezone))
            : null,
        teacherTimezone:
          booking.teacherTimezone && booking.teacherTimezone !== timezone
            ? booking.teacherTimezone
            : null,
        bookingId: booking.id,
        studentName: booking.studentName,
        teacherName: booking.teacherName,
        status: booking.status,
        href: lessonCalendarHref(role, booking.id),
        classroomHref: booking.classroomHref,
        classroomJoinable: booking.classroomJoinable,
      });
    }

    for (const group of groups) {
      if (zonedYmd(new Date(group.startsAt), timezone).iso !== isoDate) continue;
      const startMinute = minuteFromInstant(new Date(group.startsAt), timezone);
      let endMinute = minuteFromInstant(new Date(group.endsAt), timezone);
      if (endMinute <= startMinute) {
        endMinute = Math.min(24 * 60, startMinute + group.durationMinutes);
      }
      events.push({
        id: `group:${group.id}`,
        type: "group",
        title: group.title,
        detail: [group.teacherName, group.subjectName, "Group lesson"].join(" · "),
        startMinute,
        endMinute,
        startTime: formatHm(startMinute),
        endTime: formatHm(endMinute),
        teacherTime: group.teacherWhenLabel,
        teacherTimezone:
          group.teacherTimezone !== timezone ? group.teacherTimezone : null,
        groupLessonId: group.id,
        teacherName: group.teacherName,
        status: group.status,
        href:
          role === "teacher"
            ? `/teach/group-lessons#group-${group.id}`
            : `${publicGroupClassHref(group)}#group-${group.id}`,
        classroomHref: group.classroomHref,
        classroomJoinable: group.classroomJoinable,
      });
    }

    events.sort(
      (left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute,
    );
    for (const event of events) {
      hourStart = Math.min(hourStart, Math.max(0, Math.floor(event.startMinute / 60) * 60 - 60));
      hourEnd = Math.max(hourEnd, Math.min(24 * 60, Math.ceil(event.endMinute / 60) * 60 + 60));
    }

    return {
      isoDate,
      weekday,
      weekdayLabel: weekdayLabel(weekday),
      weekdayShort: weekdayLabel(weekday).slice(0, 3),
      dayNumber: parts.day,
      isToday: isoDate === todayIso,
      lessonCount: events.filter(
        (event) => event.status === "confirmed" || event.status === "completed",
      ).length,
      events,
    };
  });

  if (hourEnd - hourStart < 12 * 60) {
    hourEnd = Math.min(24 * 60, hourStart + 12 * 60);
  }

  return {
    role,
    timezone,
    timezones: timezoneOptions(timezone),
    todayIso,
    weekStart,
    weekEnd,
    prevWeekStart: addCalendarDays(weekStart, -7),
    nextWeekStart: addCalendarDays(weekStart, 7),
    weekLabel: weekLabel(weekStart, weekEnd),
    hourStart,
    hourEnd,
    nowMinute: days.some((day) => day.isToday) ? nowMinute : null,
    summary: {
      booked:
        bookings.filter((row) => row.status === "confirmed" || row.status === "completed")
          .length + groups.filter((row) => row.status === "published").length,
      cancelled: bookings.filter((row) => row.status === "cancelled").length,
    },
    days,
  };
}
