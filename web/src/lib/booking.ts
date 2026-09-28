import {
  availabilityDate,
  eachIsoDate,
  isoDateDiffDays,
  isoDateWeekday,
  parseIsoDate,
  startOfIsoWeek,
} from "@/lib/timezone";

export const DEFAULT_BOOKING_MIN_NOTICE_MINUTES = 120;
export const DEFAULT_BOOKING_CANCEL_NOTICE_MINUTES = 1440;
export const DEFAULT_BOOKING_MIN_COMMITMENT = 1;
export const MAX_RECURRING_WEEKS = 12;
export const BOOKING_HORIZON_DAYS = 28;
export const MAX_GROUP_CLASS_SESSIONS = 24;
export const MAX_GROUP_CLASS_DAYS = 112;
export const MIN_GROUP_CLASS_CAPACITY = 2;
export const MAX_GROUP_CLASS_CAPACITY = 50;
export const DEFAULT_GROUP_CLASS_CAPACITY = 6;
export const DEFAULT_GROUP_MIN_STUDENTS = 2;
export const MAX_INDIVIDUAL_AVAILABILITY_DAYS = 31;
export const MAX_BLOCKED_AVAILABILITY_DAYS = 62;
export const ALL_DAY_END_MINUTE = 24 * 60;
export const MAX_BOOKING_MIN_NOTICE_MINUTES = 7 * 24 * 60;
export const LESSON_FORMAT_ONE_TO_ONE = "one_to_one" as const;
export const DEFAULT_TRIAL_DURATION_MINUTES = 30;
export const DEFAULT_TRIAL_PRICE_PERCENT = 50;
export const PACKAGE_OPTIONS = [
  { lessons: 4, discountPercent: 5 },
  { lessons: 8, discountPercent: 10 },
  { lessons: 12, discountPercent: 15 },
] as const;
export const LESSON_DURATION_OPTIONS_MINUTES = [30, 45, 60, 90] as const;
export const BOOKING_NOTICE_OPTIONS_MINUTES = [
  60, 120, 240, 360, 720, 1440, 2880, 4320,
] as const;
export const PLATFORM_NOTICE_OPTIONS_MINUTES = [
  0, 30, ...BOOKING_NOTICE_OPTIONS_MINUTES, MAX_BOOKING_MIN_NOTICE_MINUTES,
] as const;

export const weekdayOptions = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export const bookingKinds = [
  { value: "lesson", label: "One-to-one lesson" },
  { value: "trial", label: "Trial lesson" },
] as const;

export const bookingStatuses = [
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "Did not attend" },
  { value: "waitlisted", label: "Waiting list" },
] as const;

export const cancelOutcomes = [
  { value: "no_charge", label: "No charge" },
  { value: "credit_pending", label: "Credit pending" },
  { value: "forfeit", label: "Outside notice window" },
] as const;

export type BookingKind = (typeof bookingKinds)[number]["value"];
export type BookingStatus = (typeof bookingStatuses)[number]["value"];
export type CancelOutcome = (typeof cancelOutcomes)[number]["value"];

export function bookingStatusLabel(value?: string | null) {
  return bookingStatuses.find((item) => item.value === value)?.label ?? "Booking";
}

export function bookingKindLabel(value?: string | null) {
  return bookingKinds.find((item) => item.value === value)?.label ?? "One-to-one lesson";
}

export function lessonDurationOptions(platformMinutes: number) {
  const values = new Set<number>(LESSON_DURATION_OPTIONS_MINUTES);
  if (Number.isFinite(platformMinutes) && platformMinutes >= 15 && platformMinutes <= 180) {
    values.add(platformMinutes);
  }
  return [...values].sort((left, right) => left - right);
}

export function isSupportedLessonDuration(minutes: number, platformMinutes: number) {
  return lessonDurationOptions(platformMinutes).includes(minutes);
}

export function publicGroupClassHref(lesson: {
  id: string;
  seriesId: string | null;
}) {
  return `/group-lessons/${lesson.seriesId ?? lesson.id}`;
}

export function formatLessonDuration(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} minutes`;
}

export function cancelOutcomeLabel(value?: string | null) {
  return cancelOutcomes.find((item) => item.value === value)?.label ?? null;
}

export function weekdayLabel(value?: number | null) {
  return weekdayOptions.find((item) => item.value === value)?.label ?? "Day";
}

export function sortedWeekdays(values: number[]) {
  const unique = new Set(values);
  return weekdayOptions.map((day) => day.value).filter((value) => unique.has(value));
}

export function alignSingleWeekdayToStartDate(
  weekdays: number[],
  startsOn?: string | null,
) {
  const ordered = sortedWeekdays(weekdays);
  if (!startsOn || ordered.length !== 1) {
    return ordered;
  }
  return [isoDateWeekday(startsOn)];
}

export function applySingleWeekdayAlignment<
  T extends {
    id: string;
    kind: string;
    weekday: number | null;
    recurrenceGroupId?: string | null;
    startsOn?: string | Date | null;
    localDate?: string | Date | null;
  },
>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const weeklyExtra =
      row.kind === "extra" && row.weekday != null && !row.localDate;
    if (row.kind !== "recurring" && row.kind !== "break" && !weeklyExtra) {
      continue;
    }
    const key = row.recurrenceGroupId ?? row.id;
    const members = groups.get(key) ?? [];
    members.push(row);
    groups.set(key, members);
  }

  const weekdayById = new Map<string, number>();
  for (const members of groups.values()) {
    const weekdays = members
      .map((member) => member.weekday)
      .filter((value): value is number => value != null);
    const aligned = alignSingleWeekdayToStartDate(
      weekdays,
      availabilityDate(members[0]?.startsOn),
    );
    if (aligned.length !== 1) {
      continue;
    }
    for (const member of members) {
      weekdayById.set(member.id, aligned[0]);
    }
  }

  return rows.map((row) => {
    const weekday = weekdayById.get(row.id);
    if (weekday == null || weekday === row.weekday) {
      return row;
    }
    return { ...row, weekday };
  });
}

export function formatWeekdayList(values: number[]) {
  const ordered = sortedWeekdays(values);
  if (!ordered.length) {
    return "Days";
  }
  if (ordered.length === 1) {
    return weekdayLabel(ordered[0]);
  }
  const optionValues = weekdayOptions.map((day) => day.value);
  const indexes = ordered.map((value) => optionValues.indexOf(value));
  const consecutive = indexes.every(
    (index, offset) => offset === 0 || index === indexes[offset - 1] + 1,
  );
  if (consecutive && ordered.length >= 3) {
    return `${weekdayLabel(ordered[0])}–${weekdayLabel(ordered[ordered.length - 1])}`;
  }
  return ordered.map((value) => weekdayLabel(value).slice(0, 3)).join(", ");
}

export function clampGroupClassCapacity(value: number) {
  return Math.min(
    MAX_GROUP_CLASS_CAPACITY,
    Math.max(MIN_GROUP_CLASS_CAPACITY, value),
  );
}

export function resolveGroupMinStudents(
  minStudents: number | null | undefined,
  capacity: number,
) {
  const resolvedCapacity = clampGroupClassCapacity(capacity);
  const requested = minStudents ?? DEFAULT_GROUP_MIN_STUDENTS;
  return Math.min(
    resolvedCapacity,
    Math.max(MIN_GROUP_CLASS_CAPACITY, requested),
  );
}

export function countGroupClassSessions(input: {
  startsOn: string;
  endsOn: string;
  weekdays: number[];
  weekInterval?: number;
}) {
  if (!input.startsOn || !input.endsOn || input.endsOn < input.startsOn) {
    return 1;
  }
  const weekInterval = Math.max(1, input.weekInterval ?? 1);
  const selected = input.weekdays.filter((day) => day >= 0 && day <= 6);
  const days = selected.length ? selected : [isoDateWeekday(input.startsOn)];
  let count = 0;
  for (const isoDate of eachIsoDate(input.startsOn, input.endsOn)) {
    const weekday = isoDateWeekday(isoDate);
    if (!days.includes(weekday)) continue;
    if (Math.floor(isoDateDiffDays(input.startsOn, isoDate) / 7) % weekInterval !== 0) {
      continue;
    }
    count += 1;
  }
  return Math.max(1, count);
}

export function groupClassEnrollmentStats(
  capacity: number,
  minStudents: number,
  enrolledCount: number,
) {
  const resolvedMin = resolveGroupMinStudents(minStudents, capacity);
  return {
    minStudents: resolvedMin,
    enrolledCount,
    placesLeft: Math.max(0, capacity - enrolledCount),
    isFull: enrolledCount >= capacity,
    meetsMinimum: enrolledCount >= resolvedMin,
    studentsNeeded: Math.max(0, resolvedMin - enrolledCount),
    isUnderEnrolled: enrolledCount < resolvedMin,
  };
}

export function effectiveMinNoticeMinutes(
  platformMinutes: number,
  teacherMinutes?: number | null,
) {
  return Math.max(0, platformMinutes, teacherMinutes ?? 0);
}

export function effectiveMinCommitmentLessons(
  platformLessons: number,
  teacherLessons?: number | null,
) {
  return Math.min(
    MAX_RECURRING_WEEKS,
    Math.max(1, platformLessons, teacherLessons ?? 0),
  );
}

export function noticeDurationParts(minutes: number) {
  if (minutes <= 0) {
    return { unit: "none" as const, count: 0 };
  }
  if (minutes % 1440 === 0) {
    return { unit: "days" as const, count: minutes / 1440 };
  }
  if (minutes % 60 === 0) {
    return { unit: "hours" as const, count: minutes / 60 };
  }
  return { unit: "minutes" as const, count: minutes };
}

export function formatNoticeDuration(minutes: number) {
  const parts = noticeDurationParts(minutes);
  if (parts.unit === "none") {
    return "no minimum notice";
  }
  if (parts.unit === "days") {
    return parts.count === 1 ? "1 day" : `${parts.count} days`;
  }
  if (parts.unit === "hours") {
    return parts.count === 1 ? "1 hour" : `${parts.count} hours`;
  }
  return `${parts.count} minutes`;
}

export function noticeOptionMinutes(current: number, presets: readonly number[]) {
  if (presets.includes(current)) {
    return [...presets];
  }
  return [...presets, current].sort((left, right) => left - right);
}

export function availabilityAppliesOnDate(
  window: {
    kind: string;
    weekday: number | null;
    localDate: string | null;
    startsOn?: string | null;
    endsOn?: string | null;
    weekInterval?: number | null;
  },
  isoDate: string,
  weekday: number,
) {
  const repeating =
    window.kind === "recurring" ||
    (window.kind === "break" && window.weekday != null && !window.localDate) ||
    (window.kind === "extra" && window.weekday != null && !window.localDate);
  if (!repeating) {
    return window.localDate === isoDate;
  }
  if (window.weekday !== weekday) {
    return false;
  }
  if (window.startsOn && isoDate < window.startsOn) {
    return false;
  }
  if (window.endsOn && isoDate > window.endsOn) {
    return false;
  }
  const interval = Math.max(1, window.weekInterval ?? 1);
  if (interval > 1) {
    const anchor = startOfIsoWeek(window.startsOn || isoDate);
    const weekStart = startOfIsoWeek(isoDate);
    const weeks = isoDateDiffDays(anchor, weekStart) / 7;
    if (weeks < 0 || weeks % interval !== 0) {
      return false;
    }
  }
  return true;
}

export function isClosedAvailabilityKind(kind: string) {
  return kind === "block" || kind === "break";
}

export function openWindowsForDate<
  T extends { kind: string; replacesRecurring?: boolean | null },
>(matching: T[]) {
  const extras = matching.filter((row) => row.kind === "extra");
  const blocks = matching.filter((row) => isClosedAvailabilityKind(row.kind));
  const replaces = extras.some((row) => Boolean(row.replacesRecurring));
  const open = replaces
    ? extras
    : matching.filter((row) => !isClosedAvailabilityKind(row.kind));
  return { open, blocks, extras, replaces };
}

export function isAllDayWindow(startMinute: number, endMinute: number) {
  return startMinute <= 0 && endMinute >= ALL_DAY_END_MINUTE - 1;
}

export type BookingView = {
  id: string;
  teacherUserId: string;
  teacherName: string;
  studentUserId: string;
  studentName: string;
  bookedByUserId: string;
  subjectSlug: string;
  subjectName: string | null;
  kind: string;
  kindLabel: string;
  bookingMode: "single" | "recurring" | "package";
  bookingModeLabel: string;
  format: "one_to_one";
  formatLabel: string;
  status: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  whenLabel: string;
  teacherWhenLabel: string | null;
  durationMinutes: number;
  timezone: string;
  teacherTimezone: string;
  seriesId: string | null;
  seriesIndex: number | null;
  seriesTotal: number | null;
  packageId: string | null;
  packageDiscountPercent: number | null;
  packageTotalFormatted: string | null;
  packageListedTotalFormatted: string | null;
  amountMinor: number;
  currencyCode: string;
  amountFormatted: string | null;
  listedPriceFormatted: string | null;
  priceConverted: boolean;
  cancelOutcome: string | null;
  cancelOutcomeLabel: string | null;
  cancelReason: string | null;
  cancelFinancialAction: string | null;
  cancelFinancialStatus: string | null;
  cancelFinancialLabel: string | null;
  classroomJoinable: boolean;
  classroomHref: string;
  classroomOpensAt: string;
};

export type BookingPolicyView = {
  minNoticeMinutes: number;
  cancelNoticeMinutes: number;
  minCommitmentLessons: number;
  lessonDurationMinutes: number;
  durationOptions: number[];
  trialDurationMinutes: number;
  trialPricePercent: number;
};

export type BookingChangeRecordView = {
  id: string;
  bookingId: string;
  side: "teacher" | "student";
  actorRole: string;
  actorName: string;
  kind: "cancelled" | "rescheduled";
  occurredAt: string;
  occurredLabel: string;
  lessonLabel: string;
  teacherName: string;
  studentName: string;
  fromLabel: string | null;
  toLabel: string | null;
  reason: string | null;
  outcomeLabel: string | null;
  financialLabel: string | null;
  financialAction: string | null;
  financialStatus: string | null;
};

export type BookingWorkspaceView = {
  timeZone: string;
  timezones: string[];
  bookings: BookingView[];
  changeRecords: {
    teacher: BookingChangeRecordView[];
    student: BookingChangeRecordView[];
  };
  policy?: BookingPolicyView;
};

export type AvailabilityWindowView = {
  id: string;
  kind: "recurring" | "extra" | "block" | "break";
  weekday: number | null;
  weekdayLabel: string | null;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  localDate: string | null;
  recurrenceGroupId: string;
  startsOn: string | null;
  endsOn: string | null;
  weekInterval: number;
  replacesRecurring: boolean;
  allDay: boolean;
  timezone: string;
  note: string | null;
};

export type BookingNoticeView = {
  platformMinutes: number;
  teacherMinutes: number | null;
  effectiveMinutes: number;
  options: { minutes: number; label: string }[];
};

export type BookingCommitmentView = {
  platformLessons: number;
  teacherLessons: number | null;
  effectiveLessons: number;
  options: number[];
};

export type TeacherAvailabilityState = {
  timezone: string;
  timezones: string[];
  windows: AvailabilityWindowView[];
  notice: BookingNoticeView;
  commitment: BookingCommitmentView;
};

export type TeacherCalendarEvent = {
  id: string;
  type: "hours" | "extra" | "block" | "break" | "booking" | "group";
  title: string;
  detail: string | null;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  windowId?: string;
  bookingId?: string;
  groupLessonId?: string;
  studentName?: string;
  status?: string;
  href?: string;
  classroomHref?: string;
  classroomJoinable?: boolean;
  allDay?: boolean;
};

export type TeacherCalendarHoliday = {
  id: string;
  windowId: string;
  title: string;
  detail: string | null;
};

export type TeacherCalendarDay = {
  isoDate: string;
  weekday: number;
  weekdayLabel: string;
  weekdayShort: string;
  dayNumber: number;
  isToday: boolean;
  openSlotCount: number;
  holidays: TeacherCalendarHoliday[];
  events: TeacherCalendarEvent[];
};

export type TeacherCalendarState = TeacherAvailabilityState & {
  todayIso: string;
  weekStart: string;
  weekEnd: string;
  prevWeekStart: string;
  nextWeekStart: string;
  weekLabel: string;
  hourStart: number;
  hourEnd: number;
  nowMinute: number | null;
  lessonDurationMinutes: number;
  summary: {
    booked: number;
    openSlots: number;
    blocked: number;
    weeklyWindows: number;
  };
  days: TeacherCalendarDay[];
};

export type LessonCalendarRole = "teacher" | "parent" | "student" | "staff";

export type LessonCalendarEvent = {
  id: string;
  type: "booking" | "group";
  title: string;
  detail: string | null;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  teacherTime?: string | null;
  teacherTimezone?: string | null;
  bookingId?: string;
  groupLessonId?: string;
  studentName?: string;
  teacherName?: string;
  status?: string;
  href: string;
  classroomHref?: string;
  classroomJoinable?: boolean;
};

export type LessonCalendarDay = {
  isoDate: string;
  weekday: number;
  weekdayLabel: string;
  weekdayShort: string;
  dayNumber: number;
  isToday: boolean;
  lessonCount: number;
  events: LessonCalendarEvent[];
};

export type LessonCalendarState = {
  role: LessonCalendarRole;
  timezone: string;
  timezones: string[];
  todayIso: string;
  weekStart: string;
  weekEnd: string;
  prevWeekStart: string;
  nextWeekStart: string;
  weekLabel: string;
  hourStart: number;
  hourEnd: number;
  nowMinute: number | null;
  summary: {
    booked: number;
    cancelled: number;
  };
  days: LessonCalendarDay[];
};

export function rangesOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}
