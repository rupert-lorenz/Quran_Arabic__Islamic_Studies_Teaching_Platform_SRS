import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import {
  certificates,
  cmsDocumentLocales,
  cmsDocuments,
  countries,
  currencies,
  locales,
  financeOperations,
  lessonHistory,
  marketingCampaigns,
  roles,
  safeguardingIncidents,
  safeguardingRecordingReviews,
  subjects,
  teachingMaterials,
  translations,
  teacherProfiles,
  teacherReviews,
  users,
} from "@/db/schema";
import { cmsTypeLabel } from "@/lib/cms";
import { applicationStatusLabel } from "@/lib/teacher-status";
import { formatRoleKey, hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { lessonHistoryStatusLabel } from "@/lib/lesson-history";
import {
  normalizeStaffSearchQuery,
  parseStaffSearchUuid,
  STAFF_SEARCH_LIMIT,
  STAFF_SEARCH_MIN_LENGTH,
  staffSearchPattern,
  visibleStaffSearchCatalog,
  type StaffSearchHit,
  type StaffSearchResult,
  type StaffSearchSection,
} from "@/lib/staff-search";
import { ApiError } from "@/server/api/errors";

const reviewTeachers = alias(users, "review_teachers");
const reviewParents = alias(users, "review_parents");
const lessonStudents = alias(users, "lesson_students");
const lessonTeachers = alias(users, "lesson_teachers");
const incidentUsers = alias(users, "incident_users");
const recordingUsers = alias(users, "recording_users");
const financeUsers = alias(users, "finance_users");

export const staffSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

function canSearch(actor: StaffSearchActor, keys: string | string[]) {
  return hasAnyPermission(actor, keys);
}

function section(
  key: string,
  label: string,
  href: string,
  hits: StaffSearchHit[],
): StaffSearchSection {
  return { key, label, href, hits };
}

function userMatch(pattern: string, id: string | null) {
  return id
    ? or(
        ilike(users.displayName, pattern),
        ilike(users.email, pattern),
        eq(users.id, id),
      )
    : or(ilike(users.displayName, pattern), ilike(users.email, pattern));
}

type StaffSearchActor = {
  roleKey: string;
  permissions: string[];
  twoFactorPending?: boolean;
};

export function assertCanUseStaffSearch(actor: StaffSearchActor) {
  if (actor.twoFactorPending) {
    throw new ApiError(
      403,
      "TWO_FACTOR_REQUIRED",
      "Set up two-factor authentication to continue",
    );
  }
  if (!isStaffRole(actor.roleKey) && actor.permissions.length === 0) {
    throw new ApiError(403, "FORBIDDEN", "Staff access is required");
  }
}

async function searchUsers(pattern: string, id: string | null) {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      status: users.status,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(isNull(users.deletedAt), userMatch(pattern, id)))
    .orderBy(desc(users.createdAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href:
      row.roleKey === "teacher"
        ? `/staff/teachers/${row.id}`
        : "/staff/users",
    title: row.displayName,
    detail: `${row.email} · ${row.status}`,
    badge: formatRoleKey(row.roleKey),
  })) satisfies StaffSearchHit[];
}

async function searchTeachers(pattern: string, id: string | null) {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      headline: teacherProfiles.headline,
      verificationStatus: teacherProfiles.verificationStatus,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        or(
          userMatch(pattern, id),
          ilike(teacherProfiles.headline, pattern),
        ),
      ),
    )
    .orderBy(desc(teacherProfiles.updatedAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: `/staff/teachers/${row.id}`,
    title: row.displayName,
    detail: [row.headline, row.email].filter(Boolean).join(" · "),
    badge: applicationStatusLabel(row.verificationStatus),
  })) satisfies StaffSearchHit[];
}

async function searchReviews(pattern: string) {
  const rows = await db
    .select({
      id: teacherReviews.id,
      body: teacherReviews.body,
      rating: teacherReviews.rating,
      status: teacherReviews.status,
      teacherName: reviewTeachers.displayName,
      parentName: reviewParents.displayName,
    })
    .from(teacherReviews)
    .innerJoin(reviewTeachers, eq(teacherReviews.teacherUserId, reviewTeachers.id))
    .innerJoin(reviewParents, eq(teacherReviews.parentUserId, reviewParents.id))
    .where(
      or(
        ilike(teacherReviews.body, pattern),
        ilike(reviewTeachers.displayName, pattern),
        ilike(reviewParents.displayName, pattern),
      ),
    )
    .orderBy(desc(teacherReviews.createdAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: "/staff/reviews",
    title: `${row.rating}/5 · ${row.teacherName}`,
    detail: row.body.slice(0, 140),
    badge: row.status.replaceAll("_", " "),
  })) satisfies StaffSearchHit[];
}

async function searchLessons(pattern: string) {
  const rows = await db
    .select({
      id: lessonHistory.id,
      title: lessonHistory.title,
      status: lessonHistory.status,
      notes: lessonHistory.notes,
      studentName: lessonStudents.displayName,
      teacherName: lessonTeachers.displayName,
    })
    .from(lessonHistory)
    .innerJoin(lessonStudents, eq(lessonHistory.studentUserId, lessonStudents.id))
    .leftJoin(lessonTeachers, eq(lessonHistory.teacherUserId, lessonTeachers.id))
    .where(
      or(
        ilike(lessonHistory.title, pattern),
        ilike(lessonHistory.notes, pattern),
        ilike(lessonStudents.displayName, pattern),
        ilike(lessonTeachers.displayName, pattern),
      ),
    )
    .orderBy(desc(lessonHistory.startedAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: "/staff/lessons",
    title: row.title,
    detail: [row.studentName, row.teacherName, row.notes]
      .filter(Boolean)
      .join(" · "),
    badge: lessonHistoryStatusLabel(row.status) ?? row.status,
  })) satisfies StaffSearchHit[];
}

async function searchFinance(pattern: string, id: string | null) {
  const rows = await db
    .select({
      id: financeOperations.id,
      kind: financeOperations.kind,
      status: financeOperations.status,
      reference: financeOperations.reference,
      notes: financeOperations.notes,
      counterparty: financeUsers.displayName,
    })
    .from(financeOperations)
    .leftJoin(
      financeUsers,
      eq(financeOperations.counterpartyUserId, financeUsers.id),
    )
    .where(
      or(
        ilike(financeOperations.reference, pattern),
        ilike(financeOperations.notes, pattern),
        ilike(financeUsers.displayName, pattern),
        ilike(financeUsers.email, pattern),
        id ? eq(financeOperations.id, id) : undefined,
      ),
    )
    .orderBy(desc(financeOperations.createdAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: "/staff/accounts",
    title: row.reference || row.kind.replaceAll("_", " "),
    detail: [row.counterparty, row.notes].filter(Boolean).join(" · ") ||
      row.kind.replaceAll("_", " "),
    badge: row.status.replaceAll("_", " "),
  })) satisfies StaffSearchHit[];
}

async function searchCampaigns(pattern: string) {
  const rows = await db
    .select({
      id: marketingCampaigns.id,
      name: marketingCampaigns.name,
      status: marketingCampaigns.status,
      summary: marketingCampaigns.summary,
    })
    .from(marketingCampaigns)
    .where(
      or(
        ilike(marketingCampaigns.name, pattern),
        ilike(marketingCampaigns.summary, pattern),
      ),
    )
    .orderBy(desc(marketingCampaigns.updatedAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: "/staff/marketing",
    title: row.name,
    detail: row.summary || "Marketing campaign",
    badge: row.status,
  })) satisfies StaffSearchHit[];
}

async function searchAcademic(pattern: string) {
  const [subjectRows, certificateRows, materialRows] = await Promise.all([
    db
      .select({
        slug: subjects.slug,
        name: subjects.name,
        description: subjects.description,
        isEnabled: subjects.isEnabled,
      })
      .from(subjects)
      .where(
        or(ilike(subjects.name, pattern), ilike(subjects.slug, pattern), ilike(subjects.description, pattern)),
      )
      .orderBy(subjects.sortOrder)
      .limit(STAFF_SEARCH_LIMIT),
    db
      .select({
        id: certificates.id,
        name: certificates.name,
        status: certificates.status,
        description: certificates.description,
      })
      .from(certificates)
      .where(
        or(
          ilike(certificates.name, pattern),
          ilike(certificates.description, pattern),
        ),
      )
      .orderBy(desc(certificates.updatedAt))
      .limit(STAFF_SEARCH_LIMIT),
    db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
        category: teachingMaterials.category,
        status: teachingMaterials.status,
        description: teachingMaterials.description,
      })
      .from(teachingMaterials)
      .where(
        or(
          ilike(teachingMaterials.title, pattern),
          ilike(teachingMaterials.description, pattern),
        ),
      )
      .orderBy(desc(teachingMaterials.updatedAt))
      .limit(STAFF_SEARCH_LIMIT),
  ]);

  return [
    ...subjectRows.map((row) => ({
      id: row.slug,
      href: "/staff/academic",
      title: row.name,
      detail: row.description || `Subject · ${row.slug}`,
      badge: row.isEnabled ? "Subject" : "Disabled subject",
    })),
    ...materialRows.map((row) => ({
      id: row.id,
      href: "/staff/academic",
      title: row.title,
      detail: row.description || row.category.replaceAll("_", " "),
      badge: `Library · ${row.status}`,
    })),
    ...certificateRows.map((row) => ({
      id: row.id,
      href: "/staff/academic",
      title: row.name,
      detail: row.description || "Certificate",
      badge: `Certificate · ${row.status}`,
    })),
  ].slice(0, STAFF_SEARCH_LIMIT) satisfies StaffSearchHit[];
}

async function searchIncidents(pattern: string, id: string | null) {
  const rows = await db
    .select({
      id: safeguardingIncidents.id,
      title: safeguardingIncidents.title,
      status: safeguardingIncidents.status,
      severity: safeguardingIncidents.severity,
      summary: safeguardingIncidents.summary,
      involvedName: incidentUsers.displayName,
    })
    .from(safeguardingIncidents)
    .leftJoin(
      incidentUsers,
      eq(safeguardingIncidents.involvedUserId, incidentUsers.id),
    )
    .where(
      or(
        ilike(safeguardingIncidents.title, pattern),
        ilike(safeguardingIncidents.summary, pattern),
        ilike(incidentUsers.displayName, pattern),
        ilike(incidentUsers.email, pattern),
        id ? eq(safeguardingIncidents.id, id) : undefined,
      ),
    )
    .orderBy(desc(safeguardingIncidents.updatedAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: "/staff/safeguarding",
    title: row.title,
    detail: [row.involvedName, row.summary].filter(Boolean).join(" · "),
    badge: `${row.severity} · ${row.status.replaceAll("_", " ")}`,
  })) satisfies StaffSearchHit[];
}

async function searchRecordings(pattern: string, id: string | null) {
  const rows = await db
    .select({
      id: safeguardingRecordingReviews.id,
      reference: safeguardingRecordingReviews.reference,
      status: safeguardingRecordingReviews.status,
      notes: safeguardingRecordingReviews.notes,
      relatedName: recordingUsers.displayName,
    })
    .from(safeguardingRecordingReviews)
    .leftJoin(
      recordingUsers,
      eq(safeguardingRecordingReviews.relatedUserId, recordingUsers.id),
    )
    .where(
      or(
        ilike(safeguardingRecordingReviews.reference, pattern),
        ilike(safeguardingRecordingReviews.notes, pattern),
        ilike(recordingUsers.displayName, pattern),
        id ? eq(safeguardingRecordingReviews.id, id) : undefined,
      ),
    )
    .orderBy(desc(safeguardingRecordingReviews.updatedAt))
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    href: "/staff/safeguarding",
    title: row.reference,
    detail: [row.relatedName, row.notes].filter(Boolean).join(" · ") ||
      "Recording review",
    badge: row.status.replaceAll("_", " "),
  })) satisfies StaffSearchHit[];
}

async function searchLanguages(pattern: string) {
  const [localeRows, translationRows] = await Promise.all([
    db
      .select({
        code: locales.code,
        name: locales.name,
        direction: locales.direction,
        isEnabled: locales.isEnabled,
      })
      .from(locales)
      .where(or(ilike(locales.name, pattern), ilike(locales.code, pattern)))
      .orderBy(locales.code)
      .limit(STAFF_SEARCH_LIMIT),
    db
      .select({
        id: translations.id,
        entityType: translations.entityType,
        entityKey: translations.entityKey,
        locale: translations.locale,
        field: translations.field,
        value: translations.value,
      })
      .from(translations)
      .where(
        or(
          ilike(translations.entityKey, pattern),
          ilike(translations.value, pattern),
        ),
      )
      .limit(STAFF_SEARCH_LIMIT),
  ]);

  return [
    ...localeRows.map((row) => ({
      id: row.code,
      href: "/staff/languages",
      title: row.name,
      detail: `${row.code.toUpperCase()} · ${row.direction.toUpperCase()}`,
      badge: row.isEnabled ? "Available" : "Hidden",
    })),
    ...translationRows.map((row) => ({
      id: row.id,
      href: "/staff/languages",
      title: row.value,
      detail: `${row.entityType} · ${row.entityKey} · ${row.locale} · ${row.field}`,
      badge: row.locale,
    })),
  ].slice(0, STAFF_SEARCH_LIMIT) satisfies StaffSearchHit[];
}

async function searchContent(pattern: string) {
  const rows = await db
    .select({
      id: cmsDocuments.id,
      slug: cmsDocuments.slug,
      type: cmsDocuments.type,
      status: cmsDocuments.status,
      title: cmsDocumentLocales.title,
      locale: cmsDocumentLocales.locale,
    })
    .from(cmsDocuments)
    .leftJoin(
      cmsDocumentLocales,
      eq(cmsDocumentLocales.documentId, cmsDocuments.id),
    )
    .where(
      or(
        ilike(cmsDocuments.slug, pattern),
        ilike(cmsDocumentLocales.title, pattern),
        ilike(cmsDocumentLocales.excerpt, pattern),
      ),
    )
    .orderBy(cmsDocuments.sortOrder)
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: `${row.id}:${row.locale ?? "doc"}`,
    href: `/staff/content/${row.id}`,
    title: row.title ?? row.slug,
    detail: `${cmsTypeLabel(row.type)} · ${row.slug}`,
    badge: row.status,
  })) satisfies StaffSearchHit[];
}

async function searchCurrencies(pattern: string) {
  const rows = await db
    .select({
      code: currencies.code,
      name: currencies.name,
      symbol: currencies.symbol,
      isEnabled: currencies.isEnabled,
      decimalPlaces: currencies.decimalPlaces,
    })
    .from(currencies)
    .where(
      or(
        ilike(currencies.name, pattern),
        ilike(currencies.code, pattern),
        ilike(currencies.symbol, pattern),
      ),
    )
    .orderBy(currencies.code)
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.code,
    href: "/staff/currencies",
    title: `${row.name} (${row.code})`,
    detail: `${row.symbol} · ${row.decimalPlaces} decimal places`,
    badge: row.isEnabled ? "Available" : "Hidden",
  })) satisfies StaffSearchHit[];
}

async function searchCountries(pattern: string) {
  const rows = await db
    .select({
      iso2: countries.iso2,
      iso3: countries.iso3,
      name: countries.name,
      isEnabled: countries.isEnabled,
      defaultTimezone: countries.defaultTimezone,
      defaultCurrencyCode: countries.defaultCurrencyCode,
    })
    .from(countries)
    .where(
      or(
        ilike(countries.name, pattern),
        ilike(countries.iso2, pattern),
        ilike(countries.iso3, pattern),
      ),
    )
    .orderBy(countries.sortOrder)
    .limit(STAFF_SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.iso2,
    href: "/staff/countries",
    title: row.name,
    detail: `${row.iso2} · ${row.iso3} · ${row.defaultTimezone} · ${row.defaultCurrencyCode}`,
    badge: row.isEnabled ? "Available" : "Hidden",
  })) satisfies StaffSearchHit[];
}

export async function searchStaff(
  actor: StaffSearchActor,
  rawQuery?: string | null,
): Promise<StaffSearchResult> {
  assertCanUseStaffSearch(actor);
  const query = normalizeStaffSearchQuery(rawQuery);
  const catalog = visibleStaffSearchCatalog(actor);
  const id = parseStaffSearchUuid(query);
  const tooShort = query.length < STAFF_SEARCH_MIN_LENGTH && !id;

  if (tooShort) {
    return {
      query,
      tooShort: true,
      sections: catalog.map((item) =>
        section(item.key, item.label, item.href, []),
      ),
      catalog,
    };
  }

  const pattern = staffSearchPattern(query);
  const [
    usersHits,
    teachersHits,
    reviewsHits,
    lessonsHits,
    financeHits,
    campaignHits,
    academicHits,
    incidentHits,
    recordingHits,
    countryHits,
    currencyHits,
    languageHits,
    contentHits,
  ] = await Promise.all([
    canSearch(actor, "users.read") ? searchUsers(pattern, id) : [],
    canSearch(actor, ["teachers.approve", "teachers.documents.review"])
      ? searchTeachers(pattern, id)
      : [],
    canSearch(actor, ["reviews.moderate", "teachers.approve"])
      ? searchReviews(pattern)
      : [],
    canSearch(actor, ["classes.manage", "students.manage"])
      ? searchLessons(pattern)
      : [],
    canSearch(actor, "payments.read") ? searchFinance(pattern, id) : [],
    canSearch(actor, "marketing.campaigns") ? searchCampaigns(pattern) : [],
    canSearch(actor, ["academic.curriculum", "academic.certificates"])
      ? searchAcademic(pattern)
      : [],
    canSearch(actor, "safeguarding.incidents")
      ? searchIncidents(pattern, id)
      : [],
    canSearch(actor, "safeguarding.recordings")
      ? searchRecordings(pattern, id)
      : [],
    canSearch(actor, "settings.write") ? searchCountries(pattern) : [],
    canSearch(actor, ["settings.write", "payments.read"])
      ? searchCurrencies(pattern)
      : [],
    canSearch(actor, ["settings.write", "cms.write"])
      ? searchLanguages(pattern)
      : [],
    canSearch(actor, "cms.write") ? searchContent(pattern) : [],
  ]);

  const hitsByKey: Record<string, StaffSearchHit[]> = {
    users: usersHits,
    teachers: teachersHits,
    reviews: reviewsHits,
    lessons: lessonsHits,
    finance: financeHits,
    campaigns: campaignHits,
    academic: academicHits,
    incidents: incidentHits,
    recordings: recordingHits,
    countries: countryHits,
    currencies: currencyHits,
    languages: languageHits,
    content: contentHits,
  };

  return {
    query,
    tooShort: false,
    sections: catalog.map((item) =>
      section(item.key, item.label, item.href, hitsByKey[item.key] ?? []),
    ),
    catalog,
  };
}
