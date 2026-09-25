import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { locales, platformSettings, subjects, translations } from "@/db/schema";
import {
  bundledUiMessages,
  defaultUiMessages,
  normalizeLocaleCode,
  uiMessageKeys,
  type UiMessageKey,
} from "@/lib/i18n";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { hasAnyPermission } from "@/lib/rbac";
import type { UpdateLocaleInput, UpsertTranslationInput } from "./schemas";

function settingString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadDefaultLocaleCode() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "platform.default_locale"))
    .limit(1);
  return settingString(row?.value) ?? "en";
}

async function countEnabledLocales() {
  const [row] = await db
    .select({ value: count() })
    .from(locales)
    .where(eq(locales.isEnabled, true));
  return Number(row?.value ?? 0);
}

function resolvedUiValue(locale: string, key: UiMessageKey, stored?: string) {
  if (stored) return stored;
  return bundledUiMessages[locale]?.[key] ?? (locale === "en" ? defaultUiMessages[key] : "");
}

export async function listI18nWorkspace(actor: ApiActor) {
  const [localeRows, subjectRows, translationRows, defaultLocale, translationCount] =
    await Promise.all([
      db
        .select({
          code: locales.code,
          name: locales.name,
          direction: locales.direction,
          isEnabled: locales.isEnabled,
        })
        .from(locales)
        .orderBy(locales.code),
      db
        .select({
          slug: subjects.slug,
          name: subjects.name,
          description: subjects.description,
        })
        .from(subjects)
        .orderBy(subjects.sortOrder),
      db
        .select({
          entityType: translations.entityType,
          entityKey: translations.entityKey,
          locale: translations.locale,
          field: translations.field,
          value: translations.value,
        })
        .from(translations),
      loadDefaultLocaleCode(),
      db.select({ value: count() }).from(translations),
    ]);

  const uiByKey = new Map<string, Record<string, string>>();
  const subjectByKey = new Map<string, Record<string, Record<string, string>>>();
  for (const row of translationRows) {
    if (row.entityType === "ui" && row.field === "text") {
      const values = uiByKey.get(row.entityKey) ?? {};
      values[row.locale] = row.value;
      uiByKey.set(row.entityKey, values);
    }
    if (row.entityType === "subject") {
      const localesForKey = subjectByKey.get(row.entityKey) ?? {};
      const fields = localesForKey[row.locale] ?? {};
      fields[row.field] = row.value;
      localesForKey[row.locale] = fields;
      subjectByKey.set(row.entityKey, localesForKey);
    }
  }

  return {
    defaultLocale,
    canManageLocales: hasAnyPermission(actor, "settings.write"),
    canEditTranslations: hasAnyPermission(actor, "cms.write"),
    summary: {
      locales: localeRows.length,
      enabled: localeRows.filter((item) => item.isEnabled).length,
      translations: Number(translationCount[0]?.value ?? 0),
    },
    locales: localeRows.map((row) => ({
      ...row,
      isDefault: row.code.toLowerCase() === defaultLocale.toLowerCase(),
    })),
    uiMessages: uiMessageKeys.map((key) => ({
      key,
      defaultValue: defaultUiMessages[key],
      values: Object.fromEntries(
        localeRows.map((locale) => [
          locale.code,
          resolvedUiValue(locale.code, key, uiByKey.get(key)?.[locale.code]),
        ]),
      ),
    })),
    subjects: subjectRows.map((subject) => ({
      slug: subject.slug,
      name: subject.name,
      values: Object.fromEntries(
        localeRows.map((locale) => [
          locale.code,
          {
            name:
              subjectByKey.get(subject.slug)?.[locale.code]?.name ??
              (locale.code === "en" ? subject.name : ""),
            description:
              subjectByKey.get(subject.slug)?.[locale.code]?.description ??
              (locale.code === "en" ? subject.description ?? "" : ""),
          },
        ]),
      ),
    })),
  };
}

export async function updateLocale(
  actor: ApiActor,
  codeValue: string,
  input: UpdateLocaleInput,
  ip: string,
) {
  if (!hasAnyPermission(actor, "settings.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change languages");
  }

  const code = normalizeLocaleCode(codeValue);
  if (!code) {
    throw new ApiError(400, "VALIDATION", "Language code is required");
  }

  const [current] = await db
    .select({
      code: locales.code,
      isEnabled: locales.isEnabled,
    })
    .from(locales)
    .where(eq(locales.code, code))
    .limit(1);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Language not found");
  }

  if (input.isEnabled === false && current.isEnabled) {
    const defaultLocale = await loadDefaultLocaleCode();
    if (current.code.toLowerCase() === defaultLocale.toLowerCase()) {
      throw new ApiError(
        422,
        "VALIDATION",
        "Keep the platform default language available",
      );
    }
    const enabledCount = await countEnabledLocales();
    if (enabledCount <= 1) {
      throw new ApiError(422, "VALIDATION", "Keep at least one language available");
    }
  }

  const [updated] = await db
    .update(locales)
    .set({
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    })
    .where(eq(locales.code, code))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Language not found");
  }

  await writeAuditLog({
    actor,
    action: "locales.updated",
    entityType: "locale",
    entityId: code,
    ipAddress: ip,
    metadata: input,
  });

  return listI18nWorkspace(actor);
}

export async function upsertTranslation(
  actor: ApiActor,
  input: UpsertTranslationInput,
  ip: string,
) {
  if (!hasAnyPermission(actor, "cms.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot edit translations");
  }

  const locale = normalizeLocaleCode(input.locale);
  if (!locale) {
    throw new ApiError(422, "VALIDATION", "Choose a valid language");
  }

  const [localeRow] = await db
    .select({ code: locales.code })
    .from(locales)
    .where(eq(locales.code, locale))
    .limit(1);
  if (!localeRow) {
    throw new ApiError(422, "VALIDATION", "That language is not available");
  }

  if (input.entityType === "ui") {
    if (input.field !== "text") {
      throw new ApiError(422, "VALIDATION", "UI translations use the text field");
    }
    if (!uiMessageKeys.includes(input.entityKey as UiMessageKey)) {
      throw new ApiError(422, "VALIDATION", "Unknown interface message key");
    }
  }

  if (input.entityType === "subject") {
    if (input.field !== "name" && input.field !== "description") {
      throw new ApiError(422, "VALIDATION", "Subjects use name or description");
    }
    const [subject] = await db
      .select({ slug: subjects.slug })
      .from(subjects)
      .where(eq(subjects.slug, input.entityKey))
      .limit(1);
    if (!subject) {
      throw new ApiError(404, "NOT_FOUND", "Subject not found");
    }
  }

  const [existing] = await db
    .select({ id: translations.id })
    .from(translations)
    .where(
      and(
        eq(translations.entityType, input.entityType),
        eq(translations.entityKey, input.entityKey),
        eq(translations.locale, locale),
        eq(translations.field, input.field),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(translations)
      .set({ value: input.value })
      .where(eq(translations.id, existing.id));
  } else {
    await db.insert(translations).values({
      entityType: input.entityType,
      entityKey: input.entityKey,
      locale,
      field: input.field,
      value: input.value,
    });
  }

  await writeAuditLog({
    actor,
    action: "translations.updated",
    entityType: input.entityType,
    entityId: `${input.entityKey}:${locale}:${input.field}`,
    ipAddress: ip,
  });

  return listI18nWorkspace(actor);
}
