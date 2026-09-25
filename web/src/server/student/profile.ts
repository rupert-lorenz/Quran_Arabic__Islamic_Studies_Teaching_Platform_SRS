import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { countries, studentProfiles, subjects, users } from "@/db/schema";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  formatDateOfBirth,
  normalizeStudentLevel,
  parseDateOfBirth,
  parseSubjectInterestList,
  serializeSubjectInterestList,
  studentLevelLabel,
  studentProfileCompleteness,
} from "@/lib/student-profile";
import { normalizeTeacherGender } from "@/lib/teacher-search";
import { normalizeTimezone, timezoneOptions } from "@/lib/geo";
import { resolveDisplayTimeZone } from "@/server/booking/policy";
import type { UpdateStudentProfileInput } from "./schemas";

export async function listEnabledCountries() {
  return db
    .select({ iso2: countries.iso2, name: countries.name })
    .from(countries)
    .where(eq(countries.isEnabled, true))
    .orderBy(countries.sortOrder);
}

export async function listEnabledSubjects() {
  return db
    .select({ slug: subjects.slug, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.isEnabled, true))
    .orderBy(subjects.sortOrder);
}

export async function resolveEnabledCountry(iso2: string) {
  const [country] = await db
    .select({ iso2: countries.iso2 })
    .from(countries)
    .where(
      and(
        eq(countries.iso2, iso2.toUpperCase()),
        eq(countries.isEnabled, true),
      ),
    )
    .limit(1);

  if (!country) {
    throw new ApiError(422, "VALIDATION", "Country is not available");
  }

  return country.iso2;
}

export async function resolveSubjectInterests(slugs: string[]) {
  if (slugs.length === 0) {
    return [];
  }

  const rows = await db
    .select({ slug: subjects.slug })
    .from(subjects)
    .where(and(inArray(subjects.slug, slugs), eq(subjects.isEnabled, true)));

  if (rows.length !== slugs.length) {
    throw new ApiError(422, "VALIDATION", "One or more subjects are invalid");
  }

  return rows.map((row) => row.slug);
}

export async function ensureStudentProfile(userId: string) {
  await db.insert(studentProfiles).values({ userId }).onConflictDoNothing();
}

export async function writeStudentProfileFields(
  userId: string,
  input: UpdateStudentProfileInput,
) {
  const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
  if (!dateOfBirth) {
    throw new ApiError(422, "VALIDATION", "Enter a valid date of birth");
  }

  const [country, subjectSlugs] = await Promise.all([
    resolveEnabledCountry(input.country),
    resolveSubjectInterests(input.subjectSlugs ?? []),
  ]);
  const timezone = input.timezone ? normalizeTimezone(input.timezone) : null;
  if (input.timezone && !timezone) {
    throw new ApiError(422, "VALIDATION", "Choose a valid timezone");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        displayName: input.displayName.trim(),
        country,
        ...(timezone ? { timezone } : {}),
      })
      .where(eq(users.id, userId));
    await tx
      .update(studentProfiles)
      .set({
        dateOfBirth,
        currentLevel: normalizeStudentLevel(input.currentLevel),
        languages: input.languages?.trim() || null,
        gender: normalizeTeacherGender(input.gender),
        about: input.about?.trim() || null,
        subjectInterests: serializeSubjectInterestList(subjectSlugs) || null,
      })
      .where(eq(studentProfiles.userId, userId));
  });
}

export async function getManagedStudentProfile(userId: string) {
  await ensureStudentProfile(userId);

  const [row] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      status: users.status,
      country: users.country,
      timezone: users.timezone,
      dateOfBirth: studentProfiles.dateOfBirth,
      currentLevel: studentProfiles.currentLevel,
      languages: studentProfiles.languages,
      gender: studentProfiles.gender,
      about: studentProfiles.about,
      subjectInterests: studentProfiles.subjectInterests,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Student profile not found");
  }

  const [catalog, countryRows, timezone] = await Promise.all([
    listEnabledSubjects(),
    listEnabledCountries(),
    resolveDisplayTimeZone(userId),
  ]);

  const subjectSlugs = parseSubjectInterestList(row.subjectInterests).filter(
    (slug) => catalog.some((subject) => subject.slug === slug),
  );
  const completeness = studentProfileCompleteness({
    dateOfBirth: row.dateOfBirth,
    currentLevel: row.currentLevel,
    country: row.country,
    subjectSlugs,
  });

  return {
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
    status: row.status,
    profile: {
      dateOfBirth: formatDateOfBirth(row.dateOfBirth),
      currentLevel: normalizeStudentLevel(row.currentLevel) ?? "",
      currentLevelLabel: studentLevelLabel(row.currentLevel),
      country: row.country ?? "",
      timezone,
      countryName:
        countryRows.find((item) => item.iso2 === row.country)?.name ?? null,
      languages: row.languages ?? "",
      gender: row.gender ?? "",
      about: row.about ?? "",
      subjectSlugs,
    },
    completeness,
    catalog,
    countries: countryRows,
    timezones: timezoneOptions(timezone),
  };
}

export async function updateManagedStudentProfile(
  actor: ApiActor,
  input: UpdateStudentProfileInput,
  ip: string,
) {
  await ensureStudentProfile(actor.userId);
  await writeStudentProfileFields(actor.userId, input);
  await writeAuditLog({
    actor,
    action: "students.profile_updated",
    entityType: "student_profile",
    entityId: actor.userId,
    ipAddress: ip,
  });
  return getManagedStudentProfile(actor.userId);
}
