export {
  bundledUiMessages,
  defaultUiMessages,
  uiMessageKeys,
  type UiMessageKey,
  type UiMessages,
} from "./i18n-messages";
import {
  bundledUiMessages,
  defaultUiMessages,
  type UiMessageKey,
  type UiMessages,
} from "./i18n-messages";

export const LOCALE_COOKIE_NAME = "tp_locale";
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type LocaleDirection = "ltr" | "rtl";

export type PublicLocale = {
  code: string;
  name: string;
  direction: LocaleDirection;
  isDefault: boolean;
};

export type UiMessageVars = Record<string, string | number>;

export function normalizeLocaleCode(value?: string | null) {
  const code = value?.trim().toLowerCase() ?? "";
  return /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/.test(code) ? code : null;
}

export function pickAcceptLanguage(
  header: string | null | undefined,
  enabled: string[],
) {
  if (!header || !enabled.length) {
    return null;
  }
  const tags = header.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "");
  for (const tag of tags) {
    const exact = enabled.find((code) => code.toLowerCase() === tag);
    if (exact) return exact;
    const language = tag.split("-")[0];
    const byLanguage = enabled.find(
      (code) =>
        code.toLowerCase() === language ||
        code.toLowerCase().startsWith(`${language}-`),
    );
    if (byLanguage) return byLanguage;
  }
  return null;
}

export function resolveLocaleCode(input: {
  cookie?: string | null;
  userLocale?: string | null;
  acceptLanguage?: string | null;
  defaultCode: string;
  enabled: string[];
}) {
  const enabled = input.enabled.map((code) => code.toLowerCase());
  const fallback =
    enabled.find((code) => code === input.defaultCode.toLowerCase()) ??
    enabled[0] ??
    DEFAULT_LOCALE;
  const candidates = [
    normalizeLocaleCode(input.cookie),
    normalizeLocaleCode(input.userLocale),
    pickAcceptLanguage(input.acceptLanguage, enabled),
  ];
  for (const candidate of candidates) {
    if (candidate && enabled.includes(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

export function mergeUiMessages(
  locale: string,
  overrides: Partial<UiMessages> = {},
): UiMessages {
  return {
    ...defaultUiMessages,
    ...bundledUiMessages[locale],
    ...overrides,
  };
}

export function interpolateUi(text: string, vars?: UiMessageVars) {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (value, [name, replacement]) =>
      value.replaceAll(`{${name}}`, String(replacement)),
    text,
  );
}

export function translateUi(
  messages: UiMessages,
  key: UiMessageKey,
  vars?: UiMessageVars,
) {
  return interpolateUi(messages[key] ?? defaultUiMessages[key] ?? key, vars);
}
