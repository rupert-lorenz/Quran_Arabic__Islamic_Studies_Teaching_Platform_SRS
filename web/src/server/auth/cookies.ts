import { CURRENCY_COOKIE_MAX_AGE, CURRENCY_COOKIE_NAME } from "@/lib/currency";
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from "@/lib/i18n";
import { TIMEZONE_COOKIE_MAX_AGE, TIMEZONE_COOKIE_NAME } from "@/lib/timezone";
import { getConfig } from "@/server/config";
import {
  SESSION_COOKIE_NAME,
  TWO_FACTOR_COOKIE_NAME,
} from "@/server/api/constants";
import { TWO_FACTOR_CHALLENGE_TTL_SECONDS } from "@/redis/two-factor";

export function sessionCookie(token: string, maxAgeSeconds: number) {
  const config = getConfig();
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearSessionCookie() {
  return sessionCookie("", 0);
}

export function twoFactorCookie(
  token: string,
  maxAgeSeconds = TWO_FACTOR_CHALLENGE_TTL_SECONDS,
) {
  const config = getConfig();
  const parts = [
    `${TWO_FACTOR_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearTwoFactorCookie() {
  return twoFactorCookie("", 0);
}

export function currencyCookie(code: string) {
  const config = getConfig();
  const parts = [
    `${CURRENCY_COOKIE_NAME}=${encodeURIComponent(code)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${CURRENCY_COOKIE_MAX_AGE}`,
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function localeCookie(code: string) {
  const config = getConfig();
  const parts = [
    `${LOCALE_COOKIE_NAME}=${encodeURIComponent(code)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function timezoneCookie(zone: string) {
  const config = getConfig();
  const parts = [
    `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(zone)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TIMEZONE_COOKIE_MAX_AGE}`,
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function authResponse(
  requestId: string,
  data: unknown,
  cookies: string[] = [],
  status = 200,
) {
  const response = Response.json({ ok: true, data, requestId }, { status });
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
