import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  libraryLicencePoolItems,
  libraryLicencePools,
  libraryLicenceSeats,
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

export type LibraryLicenceSeatView = {
  id: string;
  studentUserId: string;
  studentName: string;
  materialId: string | null;
  materialTitle: string | null;
  expiresAt: string | null;
};

export type LibraryLicencePoolView = {
  key: string;
  name: string;
  description: string | null;
  seatLimit: number | null;
  defaultDays: number | null;
  isEnabled: boolean;
  usedSeats: number;
  remainingSeats: number | null;
  materials: Array<{ id: string; title: string }>;
  seats: LibraryLicenceSeatView[];
};

export type LibraryLicenceDesk = {
  pools: LibraryLicencePoolView[];
  materials: Array<{ id: string; title: string }>;
};

export type LearnerLicenceView = {
  poolKey: string;
  poolName: string;
  materialTitle: string | null;
  expiresAt: string | null;
};

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage content licences");
  }
}

function stillValid(expiresAt: Date | null, revokedAt?: Date | null) {
  if (revokedAt) return false;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

function slugKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function parseOptionalDate(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid expiry date");
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

function expiryFromPool(defaultDays: number | null, expiresAt?: string) {
  const explicit = parseOptionalDate(expiresAt);
  if (explicit) return explicit;
  if (!defaultDays) return null;
  return new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000);
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

export async function listLibraryLicenceDesk(
  actor: ApiActor,
): Promise<LibraryLicenceDesk> {
  requireManager(actor);
  const [pools, items, seats, materials] = await Promise.all([
    db
      .select()
      .from(libraryLicencePools)
      .orderBy(libraryLicencePools.name),
    db
      .select({
        poolKey: libraryLicencePoolItems.poolKey,
        materialId: libraryLicencePoolItems.materialId,
        title: teachingMaterials.title,
      })
      .from(libraryLicencePoolItems)
      .innerJoin(
        teachingMaterials,
        eq(teachingMaterials.id, libraryLicencePoolItems.materialId),
      ),
    db
      .select({
        id: libraryLicenceSeats.id,
        poolKey: libraryLicenceSeats.poolKey,
        studentUserId: libraryLicenceSeats.studentUserId,
        studentName: users.displayName,
        materialId: libraryLicenceSeats.materialId,
        materialTitle: teachingMaterials.title,
        expiresAt: libraryLicenceSeats.expiresAt,
        revokedAt: libraryLicenceSeats.revokedAt,
      })
      .from(libraryLicenceSeats)
      .innerJoin(users, eq(users.id, libraryLicenceSeats.studentUserId))
      .leftJoin(
        teachingMaterials,
        eq(teachingMaterials.id, libraryLicenceSeats.materialId),
      )
      .where(isNull(libraryLicenceSeats.revokedAt))
      .orderBy(desc(libraryLicenceSeats.createdAt)),
    db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
      })
      .from(teachingMaterials)
      .where(
        and(
          eq(teachingMaterials.status, "published"),
          eq(teachingMaterials.audience, "learners"),
        ),
      )
      .orderBy(teachingMaterials.title)
      .limit(200),
  ]);

  return {
    pools: pools.map((pool) => {
      const poolSeats = seats
        .filter((seat) => seat.poolKey === pool.key && stillValid(seat.expiresAt, seat.revokedAt))
        .map((seat) => ({
          id: seat.id,
          studentUserId: seat.studentUserId,
          studentName: seat.studentName,
          materialId: seat.materialId,
          materialTitle: seat.materialTitle,
          expiresAt: seat.expiresAt?.toISOString() ?? null,
        }));
      return {
        key: pool.key,
        name: pool.name,
        description: pool.description,
        seatLimit: pool.seatLimit,
        defaultDays: pool.defaultDays,
        isEnabled: pool.isEnabled,
        usedSeats: poolSeats.length,
        remainingSeats:
          pool.seatLimit === null ? null : Math.max(0, pool.seatLimit - poolSeats.length),
        materials: items
          .filter((item) => item.poolKey === pool.key)
          .map((item) => ({ id: item.materialId, title: item.title })),
        seats: poolSeats,
      };
    }),
    materials,
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

export async function listLearnerLicences(
  actor: ApiActor,
): Promise<LearnerLicenceView[]> {
  const learnerIds = await learnerIdsForActor(actor);
  if (!learnerIds.length) return [];
  const rows = await db
    .select({
      poolKey: libraryLicenceSeats.poolKey,
      poolName: libraryLicencePools.name,
      materialTitle: teachingMaterials.title,
      expiresAt: libraryLicenceSeats.expiresAt,
      revokedAt: libraryLicenceSeats.revokedAt,
      isEnabled: libraryLicencePools.isEnabled,
    })
    .from(libraryLicenceSeats)
    .innerJoin(
      libraryLicencePools,
      eq(libraryLicencePools.key, libraryLicenceSeats.poolKey),
    )
    .leftJoin(
      teachingMaterials,
      eq(teachingMaterials.id, libraryLicenceSeats.materialId),
    )
    .where(inArray(libraryLicenceSeats.studentUserId, learnerIds))
    .orderBy(libraryLicencePools.name);
  return rows
    .filter((row) => row.isEnabled && stillValid(row.expiresAt, row.revokedAt))
    .map((row) => ({
      poolKey: row.poolKey,
      poolName: row.poolName,
      materialTitle: row.materialTitle,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    }));
}

export async function createLicencePool(
  actor: ApiActor,
  input: {
    key: string;
    name: string;
    description?: string;
    seatLimit?: number | string | null;
    defaultDays?: number | string | null;
  },
  ip: string,
) {
  requireManager(actor);
  const key = slugKey(input.key);
  const name = input.name.trim();
  if (key.length < 2 || name.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a licence key and name");
  }
  try {
    await db.insert(libraryLicencePools).values({
      key,
      name,
      description: input.description?.trim() || null,
      seatLimit: parseOptionalCount(input.seatLimit),
      defaultDays: parseOptionalCount(input.defaultDays),
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That licence pool already exists");
  }
  await writeAuditLog({
    actor,
    action: "library.licence_pool_created",
    entityType: "library_licence_pool",
    entityId: key,
    ipAddress: ip,
    metadata: { name },
  });
  return listLibraryLicenceDesk(actor);
}

export async function updateLicencePool(
  actor: ApiActor,
  input: {
    key: string;
    name?: string;
    description?: string;
    seatLimit?: number | string | null;
    defaultDays?: number | string | null;
    isEnabled?: boolean;
  },
  ip: string,
) {
  requireManager(actor);
  const [existing] = await db
    .select({ key: libraryLicencePools.key })
    .from(libraryLicencePools)
    .where(eq(libraryLicencePools.key, input.key.trim()))
    .limit(1);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Licence pool not found");
  }
  await db
    .update(libraryLicencePools)
    .set({
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.seatLimit !== undefined
        ? { seatLimit: parseOptionalCount(input.seatLimit) }
        : {}),
      ...(input.defaultDays !== undefined
        ? { defaultDays: parseOptionalCount(input.defaultDays) }
        : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    })
    .where(eq(libraryLicencePools.key, existing.key));
  await writeAuditLog({
    actor,
    action: "library.licence_pool_updated",
    entityType: "library_licence_pool",
    entityId: existing.key,
    ipAddress: ip,
    metadata: input,
  });
  return listLibraryLicenceDesk(actor);
}

export async function attachLicenceMaterial(
  actor: ApiActor,
  input: { poolKey: string; materialId: string },
  ip: string,
) {
  requireManager(actor);
  const [pool] = await db
    .select({ key: libraryLicencePools.key })
    .from(libraryLicencePools)
    .where(eq(libraryLicencePools.key, input.poolKey.trim()))
    .limit(1);
  if (!pool) {
    throw new ApiError(404, "NOT_FOUND", "Licence pool not found");
  }
  const [material] = await db
    .select({
      id: teachingMaterials.id,
      category: teachingMaterials.category,
      audience: teachingMaterials.audience,
    })
    .from(teachingMaterials)
    .where(eq(teachingMaterials.id, input.materialId))
    .limit(1);
  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (material.category === "teacher_guide" || material.audience !== "learners") {
    throw new ApiError(
      422,
      "VALIDATION",
      "Only learner materials can be licensed",
    );
  }
  try {
    await db.insert(libraryLicencePoolItems).values({
      poolKey: pool.key,
      materialId: material.id,
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That material is already on this licence");
  }
  await db
    .update(teachingMaterials)
    .set({ accessMode: "entitled" })
    .where(eq(teachingMaterials.id, material.id));
  await writeAuditLog({
    actor,
    action: "library.licence_material_attached",
    entityType: "library_licence_pool",
    entityId: pool.key,
    ipAddress: ip,
    metadata: { materialId: material.id },
  });
  return listLibraryLicenceDesk(actor);
}

export async function detachLicenceMaterial(
  actor: ApiActor,
  input: { poolKey: string; materialId: string },
  ip: string,
) {
  requireManager(actor);
  const [removed] = await db
    .delete(libraryLicencePoolItems)
    .where(
      and(
        eq(libraryLicencePoolItems.poolKey, input.poolKey.trim()),
        eq(libraryLicencePoolItems.materialId, input.materialId),
      ),
    )
    .returning({ materialId: libraryLicencePoolItems.materialId });
  if (!removed) {
    throw new ApiError(404, "NOT_FOUND", "That material is not on this licence");
  }
  await writeAuditLog({
    actor,
    action: "library.licence_material_detached",
    entityType: "library_licence_pool",
    entityId: input.poolKey,
    ipAddress: ip,
    metadata: { materialId: input.materialId },
  });
  return listLibraryLicenceDesk(actor);
}

export async function assignLicenceSeat(
  actor: ApiActor,
  input: {
    email: string;
    poolKey: string;
    materialId?: string;
    expiresAt?: string;
  },
  ip: string,
) {
  requireManager(actor);
  const student = await requireStudentByEmail(input.email);
  const [pool] = await db
    .select()
    .from(libraryLicencePools)
    .where(eq(libraryLicencePools.key, input.poolKey.trim()))
    .limit(1);
  if (!pool) {
    throw new ApiError(404, "NOT_FOUND", "Licence pool not found");
  }
  if (!pool.isEnabled) {
    throw new ApiError(422, "VALIDATION", "That licence pool is disabled");
  }
  if (input.materialId) {
    const [material] = await db
      .select({ id: teachingMaterials.id, audience: teachingMaterials.audience })
      .from(teachingMaterials)
      .where(eq(teachingMaterials.id, input.materialId))
      .limit(1);
    if (!material) {
      throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
    }
    if (material.audience !== "learners") {
      throw new ApiError(422, "VALIDATION", "Only learner materials can be licensed");
    }
  }

  const active = await db
    .select({
      id: libraryLicenceSeats.id,
      expiresAt: libraryLicenceSeats.expiresAt,
      revokedAt: libraryLicenceSeats.revokedAt,
    })
    .from(libraryLicenceSeats)
    .where(
      and(
        eq(libraryLicenceSeats.poolKey, pool.key),
        isNull(libraryLicenceSeats.revokedAt),
      ),
    );
  const used = active.filter((seat) => stillValid(seat.expiresAt, seat.revokedAt)).length;
  if (pool.seatLimit !== null && used >= pool.seatLimit) {
    throw new ApiError(409, "CONFLICT", "That licence has no seats left");
  }

  const duplicate = await db
    .select({ id: libraryLicenceSeats.id })
    .from(libraryLicenceSeats)
    .where(
      and(
        eq(libraryLicenceSeats.poolKey, pool.key),
        eq(libraryLicenceSeats.studentUserId, student.userId),
        input.materialId
          ? eq(libraryLicenceSeats.materialId, input.materialId)
          : isNull(libraryLicenceSeats.materialId),
        isNull(libraryLicenceSeats.revokedAt),
      ),
    )
    .limit(1);
  if (duplicate[0]) {
    throw new ApiError(409, "CONFLICT", "That student already has this licence");
  }

  await db.insert(libraryLicenceSeats).values({
    poolKey: pool.key,
    studentUserId: student.userId,
    materialId: input.materialId || null,
    grantedByUserId: actor.userId,
    expiresAt: expiryFromPool(pool.defaultDays, input.expiresAt),
  });
  await writeAuditLog({
    actor,
    action: "library.licence_assigned",
    entityType: "library_licence_seat",
    entityId: student.userId,
    ipAddress: ip,
    metadata: { poolKey: pool.key, materialId: input.materialId },
  });
  return listLibraryLicenceDesk(actor);
}

export async function revokeLicenceSeat(
  actor: ApiActor,
  input: { seatId: string },
  ip: string,
) {
  requireManager(actor);
  const [updated] = await db
    .update(libraryLicenceSeats)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(libraryLicenceSeats.id, input.seatId),
        isNull(libraryLicenceSeats.revokedAt),
      ),
    )
    .returning({
      id: libraryLicenceSeats.id,
      poolKey: libraryLicenceSeats.poolKey,
    });
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Licence seat not found");
  }
  await writeAuditLog({
    actor,
    action: "library.licence_revoked",
    entityType: "library_licence_seat",
    entityId: updated.id,
    ipAddress: ip,
    metadata: { poolKey: updated.poolKey },
  });
  return listLibraryLicenceDesk(actor);
}

export async function loadLicenceCoverage(materialIds: string[]) {
  if (!materialIds.length) return [];
  return db
    .select({
      poolKey: libraryLicencePoolItems.poolKey,
      materialId: libraryLicencePoolItems.materialId,
    })
    .from(libraryLicencePoolItems)
    .innerJoin(
      libraryLicencePools,
      eq(libraryLicencePools.key, libraryLicencePoolItems.poolKey),
    )
    .where(
      and(
        inArray(libraryLicencePoolItems.materialId, materialIds),
        eq(libraryLicencePools.isEnabled, true),
      ),
    );
}
