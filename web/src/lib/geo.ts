export const platformTimezones = [
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Amman",
  "Asia/Dubai",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Paris",
  "Pacific/Auckland",
] as const;

const timezoneSet = new Set<string>(platformTimezones);
const timezonePattern = /^(?:UTC|GMT|[A-Za-z]+(?:\/[A-Za-z0-9_+\-]+)+)$/;

export function normalizeIso2(value?: string | null) {
  const iso2 = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(iso2) ? iso2 : null;
}

export function normalizeIso3(value?: string | null) {
  const iso3 = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(iso3) ? iso3 : null;
}

export function normalizeCurrencyCode(value?: string | null) {
  const code = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function isValidIanaTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(value?: string | null) {
  const timezone = value?.trim() ?? "";
  if (!timezone || timezone.length > 64) {
    return null;
  }
  if (
    (timezoneSet.has(timezone) || timezonePattern.test(timezone) || timezone === "UTC") &&
    isValidIanaTimeZone(timezone)
  ) {
    return timezone;
  }
  return null;
}

export function timezoneLabel(zone: string) {
  const city = zone.split("/").pop() ?? zone;
  return city.replaceAll("_", " ");
}

export function timezoneOptions(extra?: string | null) {
  const values = new Set<string>(platformTimezones);
  const extraZone = normalizeTimezone(extra);
  if (extraZone) {
    values.add(extraZone);
  }
  return [...values].sort((left, right) => left.localeCompare(right));
}
