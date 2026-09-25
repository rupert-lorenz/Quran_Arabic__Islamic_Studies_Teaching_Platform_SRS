import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  libraryRentals,
  parentChildren,
  studentProfiles,
  teachingMaterials,
  users,
} from "@/db/schema";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { findUserByEmail } from "@/server/staff/lookup";

export type LibraryRentalStatus = "upcoming" | "active" | "ended";

export type LibraryRentalView = {
  id: string;
  studentUserId: string;
  studentName: string;
  materialId: string;
  materialTitle: string;
  startsAt: string;
  expiresAt: string;
  status: LibraryRentalStatus;
};

export type LibraryRentalDesk = {
  materials: Array<{
    id: string;
    title: string;
    rentalDays: number | null;
  }>;
  rentals: LibraryRentalView[];
};

export type LearnerRentalView = {
  materialId: string;
  materialTitle: string;
  startsAt: string;
  expiresAt: string;
  status: LibraryRentalStatus;
};

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage library rentals");
  }
}

function rentalStatus(startsAt: Date, expiresAt: Date, revokedAt?: Date | null): LibraryRentalStatus {
  if (revokedAt || expiresAt.getTime() <= Date.now()) return "ended";
  if (startsAt.getTime() > Date.now()) return "upcoming";
  return "active";
}

export function rentalIsActive(
  startsAt: Date,
  expiresAt: Date,
  revokedAt?: Date | null,
) {
  return rentalStatus(startsAt, expiresAt, revokedAt) === "active";
}

function parseOptionalDate(value?: string | null, label = "date") {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", `Enter a valid ${label}`);
  }
  return date;
}

function parseOptionalCount(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return null;
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count < 1) {
    throw new ApiError(422, "VALIDATION", "Enter a whole number of 1 or more");
  }
  return Math.round(count);
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

async function requireStudentByEmail(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "No account matches that email");
  }
  const [student] = await db
    .select({ userId: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);
  if (!student) {
    throw new ApiError(422, "VALIDATION", "That account is not a student");
  }
  return { ...user, userId: student.userId };
}

async function requireLearnerMaterial(materialId: string) {
  const [material] = await db
    .select({
      id: teachingMaterials.id,
      title: teachingMaterials.title,
      category: teachingMaterials.category,
      audience: teachingMaterials.audience,
      rentalDays: teachingMaterials.rentalDays,
    })
    .from(teachingMaterials)
    .where(eq(teachingMaterials.id, materialId))
    .limit(1);
  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (material.category === "teacher_guide" || material.audience !== "learners") {
    throw new ApiError(
      422,
      "VALIDATION",
      "Only learner materials can be rented",
    );
  }
  return material;
}

async function markEntitled(materialId: string) {
  await db
    .update(teachingMaterials)
    .set({ accessMode: "entitled" })
    .where(eq(teachingMaterials.id, materialId));
}

function toDeskRental(row: {
  id: string;
  studentUserId: string;
  studentName: string | null;
  materialId: string;
  materialTitle: string;
  startsAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}): LibraryRentalView {
  return {
    id: row.id,
    studentUserId: row.studentUserId,
    studentName: row.studentName ?? "Student",
    materialId: row.materialId,
    materialTitle: row.materialTitle,
    startsAt: row.startsAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    status: rentalStatus(row.startsAt, row.expiresAt, row.revokedAt),
  };
}

export async function listLibraryRentalDesk(
  actor: ApiActor,
): Promise<LibraryRentalDesk> {
  requireManager(actor);
  const [materials, rentals] = await Promise.all([
    db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
        rentalDays: teachingMaterials.rentalDays,
      })
      .from(teachingMaterials)
      .where(
        and(
          eq(teachingMaterials.audience, "learners"),
          ne(teachingMaterials.category, "teacher_guide"),
        ),
      )
      .orderBy(teachingMaterials.title),
    db
      .select({
        id: libraryRentals.id,
        studentUserId: libraryRentals.studentUserId,
        studentName: users.displayName,
        materialId: libraryRentals.materialId,
        materialTitle: teachingMaterials.title,
        startsAt: libraryRentals.startsAt,
        expiresAt: libraryRentals.expiresAt,
        revokedAt: libraryRentals.revokedAt,
      })
      .from(libraryRentals)
      .innerJoin(
        teachingMaterials,
        eq(teachingMaterials.id, libraryRentals.materialId),
      )
      .leftJoin(users, eq(users.id, libraryRentals.studentUserId))
      .orderBy(desc(libraryRentals.createdAt))
      .limit(200),
  ]);
  return {
    materials: materials
      .filter((item) => item.title)
      .map((item) => ({
        id: item.id,
        title: item.title,
        rentalDays: item.rentalDays,
      })),
    rentals: rentals
      .filter((row) => !row.revokedAt)
      .map(toDeskRental),
  };
}

async function learnerIdsForActor(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => child.id);
}

export async function listLearnerRentals(
  actor: ApiActor,
): Promise<LearnerRentalView[]> {
  const learnerIds = await learnerIdsForActor(actor);
  if (!learnerIds.length) return [];
  const rows = await db
    .select({
      materialId: libraryRentals.materialId,
      materialTitle: teachingMaterials.title,
      startsAt: libraryRentals.startsAt,
      expiresAt: libraryRentals.expiresAt,
      revokedAt: libraryRentals.revokedAt,
    })
    .from(libraryRentals)
    .innerJoin(
      teachingMaterials,
      eq(teachingMaterials.id, libraryRentals.materialId),
    )
    .where(
      and(
        inArray(libraryRentals.studentUserId, learnerIds),
        isNull(libraryRentals.revokedAt),
      ),
    )
    .orderBy(libraryRentals.expiresAt);
  return rows
    .filter((row) => rentalStatus(row.startsAt, row.expiresAt, row.revokedAt) !== "ended")
    .map((row) => ({
      materialId: row.materialId,
      materialTitle: row.materialTitle,
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      status: rentalStatus(row.startsAt, row.expiresAt, row.revokedAt),
    }));
}

export async function loadLearnerRentalWindows(learnerIds: string[]) {
  if (!learnerIds.length) return [];
  return db
    .select({
      materialId: libraryRentals.materialId,
      startsAt: libraryRentals.startsAt,
      expiresAt: libraryRentals.expiresAt,
      revokedAt: libraryRentals.revokedAt,
    })
    .from(libraryRentals)
    .where(
      and(
        inArray(libraryRentals.studentUserId, learnerIds),
        isNull(libraryRentals.revokedAt),
      ),
    );
}

export async function setMaterialRentalDays(
  actor: ApiActor,
  input: { materialId: string; rentalDays?: number | string | null },
  ip: string,
) {
  requireManager(actor);
  const material = await requireLearnerMaterial(input.materialId);
  const rentalDays = parseOptionalCount(input.rentalDays);
  await db
    .update(teachingMaterials)
    .set({
      rentalDays,
      ...(rentalDays ? { accessMode: "entitled" as const } : {}),
    })
    .where(eq(teachingMaterials.id, material.id));
  await writeAuditLog({
    actor,
    action: "library.rental_days_set",
    entityType: "teaching_material",
    entityId: material.id,
    ipAddress: ip,
    metadata: { rentalDays },
  });
  return listLibraryRentalDesk(actor);
}

export async function assignLibraryRental(
  actor: ApiActor,
  input: {
    email: string;
    materialId: string;
    days?: number | string | null;
    startsAt?: string;
    expiresAt?: string;
  },
  ip: string,
) {
  requireManager(actor);
  const [student, material] = await Promise.all([
    requireStudentByEmail(input.email),
    requireLearnerMaterial(input.materialId),
  ]);
  const startsAt = parseOptionalDate(input.startsAt, "start date") ?? new Date();
  const explicitEnd = parseOptionalDate(input.expiresAt, "end date");
  const days = parseOptionalCount(input.days) ?? material.rentalDays;
  const expiresAt = explicitEnd ?? (days ? addDays(startsAt, days) : null);
  if (!expiresAt) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Set a rental length or an end date",
    );
  }
  if (expiresAt.getTime() <= startsAt.getTime()) {
    throw new ApiError(422, "VALIDATION", "The rental must end after it starts");
  }

  const existing = await db
    .select({
      id: libraryRentals.id,
      startsAt: libraryRentals.startsAt,
      expiresAt: libraryRentals.expiresAt,
      revokedAt: libraryRentals.revokedAt,
    })
    .from(libraryRentals)
    .where(
      and(
        eq(libraryRentals.materialId, material.id),
        eq(libraryRentals.studentUserId, student.userId),
        isNull(libraryRentals.revokedAt),
      ),
    );
  if (existing.some((row) => rentalStatus(row.startsAt, row.expiresAt, row.revokedAt) !== "ended")) {
    throw new ApiError(
      409,
      "CONFLICT",
      "That student already has an active rental for this material",
    );
  }

  await markEntitled(material.id);
  const [created] = await db
    .insert(libraryRentals)
    .values({
      materialId: material.id,
      studentUserId: student.userId,
      startsAt,
      expiresAt,
      grantedByUserId: actor.userId,
    })
    .returning({ id: libraryRentals.id });
  await writeAuditLog({
    actor,
    action: "library.rental_assigned",
    entityType: "library_rental",
    entityId: created?.id ?? material.id,
    ipAddress: ip,
    metadata: {
      materialId: material.id,
      studentUserId: student.userId,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });
  return listLibraryRentalDesk(actor);
}

export async function extendLibraryRental(
  actor: ApiActor,
  input: {
    rentalId: string;
    days?: number | string | null;
    expiresAt?: string;
  },
  ip: string,
) {
  requireManager(actor);
  const [rental] = await db
    .select({
      id: libraryRentals.id,
      materialId: libraryRentals.materialId,
      expiresAt: libraryRentals.expiresAt,
      revokedAt: libraryRentals.revokedAt,
    })
    .from(libraryRentals)
    .where(eq(libraryRentals.id, input.rentalId))
    .limit(1);
  if (!rental || rental.revokedAt) {
    throw new ApiError(404, "NOT_FOUND", "Rental not found");
  }
  const explicitEnd = parseOptionalDate(input.expiresAt, "end date");
  const days = parseOptionalCount(input.days);
  const base =
    rental.expiresAt.getTime() > Date.now() ? rental.expiresAt : new Date();
  const expiresAt = explicitEnd ?? (days ? addDays(base, days) : null);
  if (!expiresAt) {
    throw new ApiError(422, "VALIDATION", "Set extra days or a new end date");
  }
  if (expiresAt.getTime() <= Date.now()) {
    throw new ApiError(422, "VALIDATION", "The new end date must be in the future");
  }
  await db
    .update(libraryRentals)
    .set({ expiresAt })
    .where(eq(libraryRentals.id, rental.id));
  await writeAuditLog({
    actor,
    action: "library.rental_extended",
    entityType: "library_rental",
    entityId: rental.id,
    ipAddress: ip,
    metadata: {
      materialId: rental.materialId,
      expiresAt: expiresAt.toISOString(),
    },
  });
  return listLibraryRentalDesk(actor);
}

export async function endLibraryRental(
  actor: ApiActor,
  input: { rentalId: string },
  ip: string,
) {
  requireManager(actor);
  const [ended] = await db
    .update(libraryRentals)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(libraryRentals.id, input.rentalId), isNull(libraryRentals.revokedAt)),
    )
    .returning({
      id: libraryRentals.id,
      materialId: libraryRentals.materialId,
    });
  if (!ended) {
    throw new ApiError(404, "NOT_FOUND", "Rental not found");
  }
  await writeAuditLog({
    actor,
    action: "library.rental_ended",
    entityType: "library_rental",
    entityId: ended.id,
    ipAddress: ip,
    metadata: { materialId: ended.materialId },
  });
  return listLibraryRentalDesk(actor);
}
