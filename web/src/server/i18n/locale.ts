import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { locales, platformSettings, subjects, translations, users } from "@/db/schema";
import { localizeBrand } from "@/lib/brand";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  bundledUiMessages,
  defaultUiMessages,
  mergeUiMessages,
  normalizeLocaleCode,
  resolveLocaleCode,
  translateUi,
  uiMessageKeys,
  type PublicLocale,
  type UiMessageKey,
  type UiMessageVars,
  type UiMessages,
} from "@/lib/i18n";
import { subjects as siteSubjects } from "@/lib/site";
import { getBrand } from "@/server/brand";
import { getServerUser } from "@/server/auth/session";
import { ApiError } from "@/server/api/errors";
import type { ApiActor } from "@/server/api/auth";

const fallbackLocale: PublicLocale = {
  code: DEFAULT_LOCALE,
  name: "English",
  direction: "ltr",
  isDefault: true,
};

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadLocaleRows() {
  return db
    .select({
      code: locales.code,
      name: locales.name,
      direction: locales.direction,
      isEnabled: locales.isEnabled,
    })
    .from(locales)
    .orderBy(locales.code);
}

async function loadDefaultLocaleCode() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "platform.default_locale"))
    .limit(1);
  return settingString(row?.value) ?? DEFAULT_LOCALE;
}

export const getRequestLocaleContext = cache(async () => {
  try {
    const [rows, defaultCode, store, headerStore, user] = await Promise.all([
      loadLocaleRows(),
      loadDefaultLocaleCode(),
      cookies(),
      headers(),
      getServerUser(),
    ]);
    const enabled = rows.filter((row) => row.isEnabled);
    const enabledCodes = enabled.map((row) => row.code);
    const code = resolveLocaleCode({
      cookie: store.get(LOCALE_COOKIE_NAME)?.value,
      userLocale: user?.locale,
      acceptLanguage: headerStore.get("accept-language"),
      defaultCode,
      enabled: enabledCodes,
    });
    const row = enabled.find((item) => item.code === code) ?? enabled[0];
    const locale: PublicLocale = row
      ? {
          code: row.code,
          name: row.name,
          direction: row.direction,
          isDefault: row.code.toLowerCase() === defaultCode.toLowerCase(),
        }
      : fallbackLocale;
    return {
      locale,
      locales: enabled.map((item) => ({
        code: item.code,
        name: item.name,
        direction: item.direction,
        isDefault: item.code.toLowerCase() === defaultCode.toLowerCase(),
      })) satisfies PublicLocale[],
      defaultCode,
    };
  } catch {
    return {
      locale: fallbackLocale,
      locales: [fallbackLocale],
      defaultCode: DEFAULT_LOCALE,
    };
  }
});

export async function getRequestLocale() {
  return (await getRequestLocaleContext()).locale;
}

async function loadUiOverrides(locale: string): Promise<Partial<UiMessages>> {
  const rows = await db
    .select({
      entityKey: translations.entityKey,
      value: translations.value,
    })
    .from(translations)
    .where(
      and(
        eq(translations.entityType, "ui"),
        eq(translations.locale, locale),
        eq(translations.field, "text"),
      ),
    );

  const overrides: Partial<UiMessages> = {};
  for (const row of rows) {
    if (uiMessageKeys.includes(row.entityKey as UiMessageKey)) {
      overrides[row.entityKey as UiMessageKey] = row.value;
    }
  }
  return overrides;
}

export const getI18n = cache(async () => {
  const [{ locale, locales }, brand] = await Promise.all([
    getRequestLocaleContext(),
    getBrand(),
  ]);
  const overrides = await loadUiOverrides(locale.code).catch(() => ({}));
  const messages = mergeUiMessages(locale.code, overrides);
  const localized = localizeBrand(
    brand,
    locale.code,
    locale.code === DEFAULT_LOCALE
      ? brand.description
      : messages["brand.description"],
  );

  return {
    locale,
    locales,
    messages,
    brand: localized,
    t: (key: UiMessageKey, vars?: UiMessageVars) =>
      translateUi(messages, key, vars),
  };
});

export async function loadEntityTranslations(entityType: string, locale: string) {
  const rows = await db
    .select({
      entityKey: translations.entityKey,
      field: translations.field,
      value: translations.value,
    })
    .from(translations)
    .where(
      and(
        eq(translations.entityType, entityType),
        eq(translations.locale, locale),
      ),
    );

  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const fields = map.get(row.entityKey) ?? {};
    fields[row.field] = row.value;
    map.set(row.entityKey, fields);
  }
  return map;
}

export async function listTranslatedSubjects(locale?: string) {
  const code = locale ?? (await getRequestLocale()).code;
  const [rows, fields] = await Promise.all([
    db
      .select({
        slug: subjects.slug,
        name: subjects.name,
        description: subjects.description,
      })
      .from(subjects)
      .where(eq(subjects.isEnabled, true))
      .orderBy(subjects.sortOrder),
    loadEntityTranslations("subject", code),
  ]);
  const siteBySlug = new Map<string, (typeof siteSubjects)[number]>(
    siteSubjects.map((item) => [item.slug, item]),
  );

  return rows.map((row) => {
    const translated = fields.get(row.slug);
    const site = siteBySlug.get(row.slug);
    const name = translated?.name || row.name;
    const description =
      translated?.description || site?.summary || row.description || "";
    return {
      slug: row.slug,
      name,
      description,
      summary: description,
      tone: site?.tone ?? "mint",
    };
  });
}

export async function listTranslatedSubjectNames(locale?: string) {
  const items = await listTranslatedSubjects(locale);
  return items.map((item) => ({ slug: item.slug, name: item.name }));
}

export async function getTranslatedSubject(slug: string, locale?: string) {
  const items = await listTranslatedSubjects(locale);
  return items.find((item) => item.slug === slug) ?? null;
}

export async function setPreferredLocale(code: string, actor: ApiActor | null) {
  const normalized = normalizeLocaleCode(code);
  if (!normalized) {
    throw new ApiError(422, "VALIDATION", "Choose a valid language");
  }

  const [row] = await db
    .select({
      code: locales.code,
      name: locales.name,
      direction: locales.direction,
      isEnabled: locales.isEnabled,
    })
    .from(locales)
    .where(eq(locales.code, normalized))
    .limit(1);

  if (!row?.isEnabled) {
    throw new ApiError(422, "VALIDATION", "That language is not available");
  }

  if (actor) {
    await db
      .update(users)
      .set({ locale: row.code })
      .where(eq(users.id, actor.userId));
  }

  return {
    code: row.code,
    name: row.name,
    direction: row.direction,
  };
}
