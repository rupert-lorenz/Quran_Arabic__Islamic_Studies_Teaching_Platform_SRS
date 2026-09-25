import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { countries, parentProfiles, users } from "@/db/schema";
import { listParentChildren } from "./children";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  normalizeParentPhone,
  normalizeParentRelationship,
  parentProfileCompleteness,
  parentRelationshipLabel,
} from "@/lib/parent-profile";
import { formatDateOfBirth, parseDateOfBirth } from "@/lib/student-profile";
import { listEnabledCountries } from "@/server/student/profile";
import { normalizeTimezone, timezoneOptions } from "@/lib/geo";
import { resolveDisplayTimeZone } from "@/server/booking/policy";
import type { UpdateParentProfileInput } from "./schemas";

async function resolveEnabledCountry(iso2: string) {
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

export async function ensureParentProfile(userId: string) {
  await db.insert(parentProfiles).values({ userId }).onConflictDoNothing();
}

export async function writeParentProfileFields(
  userId: string,
  input: UpdateParentProfileInput,
) {
  const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
  if (!dateOfBirth) {
    throw new ApiError(422, "VALIDATION", "Enter a valid date of birth");
  }

  const country = await resolveEnabledCountry(input.country);
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
      .update(parentProfiles)
      .set({
        dateOfBirth,
        relationship: normalizeParentRelationship(input.relationship),
        phone: normalizeParentPhone(input.phone),
        about: input.about?.trim() || null,
      })
      .where(eq(parentProfiles.userId, userId));
  });
}

export async function getManagedParentProfile(userId: string) {
  await ensureParentProfile(userId);

  const [row] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      status: users.status,
      country: users.country,
      timezone: users.timezone,
      dateOfBirth: parentProfiles.dateOfBirth,
      relationship: parentProfiles.relationship,
      phone: parentProfiles.phone,
      about: parentProfiles.about,
    })
    .from(parentProfiles)
    .innerJoin(users, eq(parentProfiles.userId, users.id))
    .where(eq(parentProfiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Parent profile not found");
  }

  const [countryRows, children, timezone] = await Promise.all([
    listEnabledCountries(),
    listParentChildren(userId),
    resolveDisplayTimeZone(userId),
  ]);

  const completeness = parentProfileCompleteness({
    dateOfBirth: row.dateOfBirth,
    relationship: row.relationship,
    country: row.country,
  });

  return {
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
    status: row.status,
    profile: {
      dateOfBirth: formatDateOfBirth(row.dateOfBirth),
      relationship: normalizeParentRelationship(row.relationship) ?? "",
      relationshipLabel: parentRelationshipLabel(row.relationship),
      country: row.country ?? "",
      timezone,
      countryName:
        countryRows.find((item) => item.iso2 === row.country)?.name ?? null,
      phone: row.phone ?? "",
      about: row.about ?? "",
    },
    children,
    completeness,
    countries: countryRows,
    timezones: timezoneOptions(timezone),
  };
}

export async function updateManagedParentProfile(
  actor: ApiActor,
  input: UpdateParentProfileInput,
  ip: string,
) {
  await ensureParentProfile(actor.userId);
  await writeParentProfileFields(actor.userId, input);
  await writeAuditLog({
    actor,
    action: "parents.profile_updated",
    entityType: "parent_profile",
    entityId: actor.userId,
    ipAddress: ip,
  });
  return getManagedParentProfile(actor.userId);
}
