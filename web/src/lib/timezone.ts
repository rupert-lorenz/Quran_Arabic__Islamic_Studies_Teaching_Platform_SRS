import { normalizeTimezone, timezoneLabel } from "@/lib/geo";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TIMEZONE_COOKIE_NAME = "tp_timezone";
export const TIMEZONE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const DEFAULT_TIMEZONE = "Europe/London";

export function detectBrowserTimeZone() {
  try {
    return normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}

export function withTimeZoneQuery(path: string, timeZone?: string | null) {
  const zone = timeZone || detectBrowserTimeZone();
  if (!zone) {
    return path;
  }
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}timeZone=${encodeURIComponent(zone)}`;
}

export { timezoneLabel };

export function tzOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      value[part.type] = part.value;
    }
  }
  const asUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  );
  return asUtc - instant.getTime();
}

export function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = asUtc;
  for (let index = 0; index < 2; index += 1) {
    instant = asUtc - tzOffsetMs(new Date(instant), timeZone);
  }
  return new Date(instant);
}

export function zonedYmd(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      value[part.type] = part.value;
    }
  }
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    iso: `${value.year}-${value.month}-${value.day}`,
  };
}

export function zonedWeekday(instant: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(instant);
  return WEEKDAY_SHORT.indexOf(weekday);
}

export function zonedHms(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      value[part.type] = part.value;
    }
  }
  return {
    hour: Number(value.hour),
    minute: Number(value.minute),
    second: Number(value.second),
  };
}

export function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return { year, month, day };
}

export function isoDateWeekday(isoDate: string) {
  const { year, month, day } = parseIsoDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export function availabilityDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function addCalendarDays(isoDate: string, days: number) {
  const { year, month, day } = parseIsoDate(isoDate);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function startOfIsoWeek(isoDate: string) {
  const { year, month, day } = parseIsoDate(isoDate);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addCalendarDays(isoDate, offset);
}

export function isoDateDiffDays(fromIso: string, toIso: string) {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) -
      Date.UTC(from.year, from.month - 1, from.day)) /
      86_400_000,
  );
}

export function formatIsoDateLabel(isoDate: string) {
  const { year, month, day } = parseIsoDate(isoDate);
  const months = [
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
  return `${day} ${months[month - 1]} ${year}`;
}

export function eachIsoDate(fromIso: string, toIso: string) {
  const dates: string[] = [];
  let cursor = fromIso;
  while (cursor <= toIso) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

export function minuteOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function splitMinute(total: number) {
  return {
    hour: Math.floor(total / 60),
    minute: total % 60,
  };
}

export function formatHm(total: number) {
  if (total >= 24 * 60) {
    return "24:00";
  }
  const { hour, minute } = splitMinute(total);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseHm(value: string) {
  const trimmed = value.trim();
  if (trimmed === "24:00") {
    return 24 * 60;
  }
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatInTimeZone(
  instant: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
  locale = "en-GB",
) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...(options ?? { dateStyle: "medium", timeStyle: "short" }),
  }).format(date);
}

export function formatClockInTimeZone(
  instant: Date | string,
  timeZone: string,
  locale?: string,
) {
  return formatInTimeZone(
    instant,
    timeZone,
    { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    locale,
  );
}

export function convertedTimeLabels(
  instant: Date | string,
  viewerTimeZone: string,
  otherTimeZone?: string | null,
  locale?: string,
) {
  const viewer = formatInTimeZone(instant, viewerTimeZone, undefined, locale);
  const viewerClock = formatClockInTimeZone(instant, viewerTimeZone, locale);
  if (!otherTimeZone || otherTimeZone === viewerTimeZone) {
    return {
      viewer,
      viewerClock,
      other: null as string | null,
      otherClock: null as string | null,
      otherZone: null as string | null,
      converted: false,
    };
  }
  return {
    viewer,
    viewerClock,
    other: formatInTimeZone(instant, otherTimeZone, undefined, locale),
    otherClock: formatClockInTimeZone(instant, otherTimeZone, locale),
    otherZone: otherTimeZone,
    converted: true,
  };
}
