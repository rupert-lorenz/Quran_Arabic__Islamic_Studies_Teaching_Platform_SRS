import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  libraryLicencePools,
  libraryLicenceSeats,
  libraryPurchases,
  libraryRentals,
  librarySubscriptionPlans,
  librarySubscriptions,
  teachingMaterialGrants,
  teachingMaterials,
  users,
} from "@/db/schema";
import {
  LIBRARY_EXPIRY_KINDS,
  libraryExpiryStatus,
  type LibraryExpiryKind,
  type LibraryExpiryStatus,
} from "@/lib/library-materials";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";

export type LibraryExpiryRow = {
  kind: LibraryExpiryKind;
  id: string;
  studentName: string;
  label: string;
  expiresAt: string | null;
  status: LibraryExpiryStatus;
  canClear: boolean;
};

export type LibraryExpiryDesk = {
  rows: LibraryExpiryRow[];
};

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage library expiry dates");
  }
}

function parseExpiryDate(value?: string | null, required = false) {
  if (!value?.trim()) {
    if (required) {
      throw new ApiError(422, "VALIDATION", "Enter an expiry date");
    }
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid expiry date");
  }
  return date;
}

function toRow(
  kind: LibraryExpiryKind,
  id: string,
  studentName: string | null,
  label: string,
  expiresAt: Date | null,
  canClear: boolean,
): LibraryExpiryRow {
  return {
    kind,
    id,
    studentName: studentName ?? "Student",
    label,
    expiresAt: expiresAt?.toISOString() ?? null,
    status: libraryExpiryStatus(expiresAt),
    canClear,
  };
}

export async function listLibraryExpiryDesk(
  actor: ApiActor,
): Promise<LibraryExpiryDesk> {
  requireManager(actor);
  const [purchases, rentals, subscriptions, seats, grants] = await Promise.all([
    db
      .select({
        id: libraryPurchases.id,
        studentName: users.displayName,
        label: teachingMaterials.title,
        expiresAt: libraryPurchases.expiresAt,
      })
      .from(libraryPurchases)
      .innerJoin(
        teachingMaterials,
        eq(teachingMaterials.id, libraryPurchases.materialId),
      )
      .leftJoin(users, eq(users.id, libraryPurchases.studentUserId))
      .where(isNull(libraryPurchases.revokedAt))
      .orderBy(desc(libraryPurchases.purchasedAt))
      .limit(80),
    db
      .select({
        id: libraryRentals.id,
        studentName: users.displayName,
        label: teachingMaterials.title,
        expiresAt: libraryRentals.expiresAt,
      })
      .from(libraryRentals)
      .innerJoin(
        teachingMaterials,
        eq(teachingMaterials.id, libraryRentals.materialId),
      )
      .leftJoin(users, eq(users.id, libraryRentals.studentUserId))
      .where(isNull(libraryRentals.revokedAt))
      .orderBy(desc(libraryRentals.createdAt))
      .limit(80),
    db
      .select({
        id: librarySubscriptions.id,
        studentName: users.displayName,
        label: librarySubscriptionPlans.name,
        expiresAt: librarySubscriptions.expiresAt,
      })
      .from(librarySubscriptions)
      .innerJoin(
        librarySubscriptionPlans,
        eq(librarySubscriptionPlans.key, librarySubscriptions.planKey),
      )
      .leftJoin(users, eq(users.id, librarySubscriptions.studentUserId))
      .where(eq(librarySubscriptions.status, "active"))
      .orderBy(desc(librarySubscriptions.createdAt))
      .limit(80),
    db
      .select({
        id: libraryLicenceSeats.id,
        studentName: users.displayName,
        label: libraryLicencePools.name,
        expiresAt: libraryLicenceSeats.expiresAt,
      })
      .from(libraryLicenceSeats)
      .innerJoin(
        libraryLicencePools,
        eq(libraryLicencePools.key, libraryLicenceSeats.poolKey),
      )
      .leftJoin(users, eq(users.id, libraryLicenceSeats.studentUserId))
      .where(isNull(libraryLicenceSeats.revokedAt))
      .orderBy(desc(libraryLicenceSeats.createdAt))
      .limit(80),
    db
      .select({
        id: teachingMaterialGrants.id,
        studentName: users.displayName,
        label: teachingMaterials.title,
        expiresAt: teachingMaterialGrants.expiresAt,
      })
      .from(teachingMaterialGrants)
      .innerJoin(
        teachingMaterials,
        eq(teachingMaterials.id, teachingMaterialGrants.materialId),
      )
      .leftJoin(users, eq(users.id, teachingMaterialGrants.studentUserId))
      .where(isNull(teachingMaterialGrants.revokedAt))
      .orderBy(desc(teachingMaterialGrants.createdAt))
      .limit(80),
  ]);

  const rows = [
    ...purchases.map((row) =>
      toRow("purchase", row.id, row.studentName, row.label, row.expiresAt, true),
    ),
    ...rentals.map((row) =>
      toRow("rental", row.id, row.studentName, row.label, row.expiresAt, false),
    ),
    ...subscriptions.map((row) =>
      toRow("subscription", row.id, row.studentName, row.label, row.expiresAt, true),
    ),
    ...seats.map((row) =>
      toRow("licence", row.id, row.studentName, row.label, row.expiresAt, true),
    ),
    ...grants.map((row) =>
      toRow("grant", row.id, row.studentName, row.label, row.expiresAt, true),
    ),
  ].sort((a, b) => {
    const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  return { rows };
}

export async function setLibraryExpiry(
  actor: ApiActor,
  input: { kind: LibraryExpiryKind; id: string; expiresAt?: string | null },
  ip: string,
) {
  requireManager(actor);
  if (!LIBRARY_EXPIRY_KINDS.includes(input.kind)) {
    throw new ApiError(422, "VALIDATION", "Choose a valid access type");
  }
  const required = input.kind === "rental";
  const expiresAt = parseExpiryDate(input.expiresAt, required);
  if (required && expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new ApiError(422, "VALIDATION", "The rental must end in the future");
  }
  if (!required && expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new ApiError(422, "VALIDATION", "The new end date must be in the future");
  }

  let found = false;
  if (input.kind === "purchase") {
    const [updated] = await db
      .update(libraryPurchases)
      .set({ expiresAt })
      .where(and(eq(libraryPurchases.id, input.id), isNull(libraryPurchases.revokedAt)))
      .returning({ id: libraryPurchases.id });
    found = Boolean(updated);
  } else if (input.kind === "rental") {
    const [updated] = await db
      .update(libraryRentals)
      .set({ expiresAt: expiresAt! })
      .where(and(eq(libraryRentals.id, input.id), isNull(libraryRentals.revokedAt)))
      .returning({ id: libraryRentals.id });
    found = Boolean(updated);
  } else if (input.kind === "subscription") {
    const [updated] = await db
      .update(librarySubscriptions)
      .set({ expiresAt, status: "active" })
      .where(
        and(
          eq(librarySubscriptions.id, input.id),
          eq(librarySubscriptions.status, "active"),
        ),
      )
      .returning({ id: librarySubscriptions.id });
    found = Boolean(updated);
  } else if (input.kind === "licence") {
    const [updated] = await db
      .update(libraryLicenceSeats)
      .set({ expiresAt })
      .where(and(eq(libraryLicenceSeats.id, input.id), isNull(libraryLicenceSeats.revokedAt)))
      .returning({ id: libraryLicenceSeats.id });
    found = Boolean(updated);
  } else {
    const [updated] = await db
      .update(teachingMaterialGrants)
      .set({ expiresAt })
      .where(
        and(
          eq(teachingMaterialGrants.id, input.id),
          isNull(teachingMaterialGrants.revokedAt),
        ),
      )
      .returning({ id: teachingMaterialGrants.id });
    found = Boolean(updated);
  }

  if (!found) {
    throw new ApiError(404, "NOT_FOUND", "That access record was not found");
  }
  await writeAuditLog({
    actor,
    action: "library.expiry_set",
    entityType: `library_${input.kind}`,
    entityId: input.id,
    ipAddress: ip,
    metadata: { expiresAt: expiresAt?.toISOString() ?? null },
  });
  return listLibraryExpiryDesk(actor);
}

export async function clearLibraryExpiry(
  actor: ApiActor,
  input: { kind: LibraryExpiryKind; id: string },
  ip: string,
) {
  if (input.kind === "rental") {
    throw new ApiError(422, "VALIDATION", "A rental must keep an end date");
  }
  return setLibraryExpiry(actor, { ...input, expiresAt: null }, ip);
}
