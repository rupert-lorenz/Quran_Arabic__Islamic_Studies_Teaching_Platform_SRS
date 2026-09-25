import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  libraryPurchases,
  parentChildren,
  studentProfiles,
  teachingMaterials,
  users,
} from "@/db/schema";
import { libraryExpiryStillValid } from "@/lib/library-materials";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { findUserByEmail } from "@/server/staff/lookup";

export type LibraryPurchaseView = {
  id: string;
  studentUserId: string;
  studentName: string;
  materialId: string;
  materialTitle: string;
  purchasedAt: string;
  expiresAt: string | null;
};

export type LibraryPurchaseDesk = {
  materials: Array<{
    id: string;
    title: string;
    isPurchasable: boolean;
  }>;
  purchases: LibraryPurchaseView[];
};

export type LearnerPurchaseView = {
  materialId: string;
  materialTitle: string;
  purchasedAt: string;
  expiresAt: string | null;
};

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage library purchases");
  }
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
      "Only learner materials can be purchased",
    );
  }
  return material;
}

export async function listLibraryPurchaseDesk(
  actor: ApiActor,
): Promise<LibraryPurchaseDesk> {
  requireManager(actor);
  const [materials, purchases] = await Promise.all([
    db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
        isPurchasable: teachingMaterials.isPurchasable,
      })
      .from(teachingMaterials)
      .where(
        and(
          eq(teachingMaterials.audience, "learners"),
          ne(teachingMaterials.category, "teacher_guide"),
        ),
      )
      .orderBy(teachingMaterials.title)
      .limit(200),
    db
      .select({
        id: libraryPurchases.id,
        studentUserId: libraryPurchases.studentUserId,
        studentName: users.displayName,
        materialId: libraryPurchases.materialId,
        materialTitle: teachingMaterials.title,
        purchasedAt: libraryPurchases.purchasedAt,
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
      .limit(200),
  ]);
  return {
    materials,
    purchases: purchases.map((row) => ({
      id: row.id,
      studentUserId: row.studentUserId,
      studentName: row.studentName ?? "Student",
      materialId: row.materialId,
      materialTitle: row.materialTitle,
      purchasedAt: row.purchasedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
    })),
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

export async function listLearnerPurchases(
  actor: ApiActor,
): Promise<LearnerPurchaseView[]> {
  const learnerIds = await learnerIdsForActor(actor);
  if (!learnerIds.length) return [];
  const rows = await db
    .select({
      materialId: libraryPurchases.materialId,
      materialTitle: teachingMaterials.title,
      purchasedAt: libraryPurchases.purchasedAt,
      expiresAt: libraryPurchases.expiresAt,
    })
    .from(libraryPurchases)
    .innerJoin(
      teachingMaterials,
      eq(teachingMaterials.id, libraryPurchases.materialId),
    )
    .where(
      and(
        inArray(libraryPurchases.studentUserId, learnerIds),
        isNull(libraryPurchases.revokedAt),
      ),
    )
    .orderBy(desc(libraryPurchases.purchasedAt));
  return rows
    .filter((row) => libraryExpiryStillValid(row.expiresAt))
    .map((row) => ({
      materialId: row.materialId,
      materialTitle: row.materialTitle,
      purchasedAt: row.purchasedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
    }));
}

export async function loadLearnerPurchases(learnerIds: string[]) {
  if (!learnerIds.length) return [];
  return db
    .select({
      materialId: libraryPurchases.materialId,
      expiresAt: libraryPurchases.expiresAt,
      revokedAt: libraryPurchases.revokedAt,
    })
    .from(libraryPurchases)
    .where(
      and(
        inArray(libraryPurchases.studentUserId, learnerIds),
        isNull(libraryPurchases.revokedAt),
      ),
    );
}

export async function setMaterialPurchasable(
  actor: ApiActor,
  input: { materialId: string; isPurchasable: boolean },
  ip: string,
) {
  requireManager(actor);
  const material = await requireLearnerMaterial(input.materialId);
  await db
    .update(teachingMaterials)
    .set({
      isPurchasable: input.isPurchasable,
      ...(input.isPurchasable ? { accessMode: "entitled" as const } : {}),
    })
    .where(eq(teachingMaterials.id, material.id));
  await writeAuditLog({
    actor,
    action: "library.purchase_flag_set",
    entityType: "teaching_material",
    entityId: material.id,
    ipAddress: ip,
    metadata: { isPurchasable: input.isPurchasable },
  });
  return listLibraryPurchaseDesk(actor);
}

function parseOptionalDate(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid expiry date");
  }
  if (date.getTime() <= Date.now()) {
    throw new ApiError(422, "VALIDATION", "The expiry date must be in the future");
  }
  return date;
}

export async function assignLibraryPurchase(
  actor: ApiActor,
  input: { email: string; materialId: string; expiresAt?: string },
  ip: string,
) {
  requireManager(actor);
  const [student, material] = await Promise.all([
    requireStudentByEmail(input.email),
    requireLearnerMaterial(input.materialId),
  ]);
  const expiresAt = parseOptionalDate(input.expiresAt);
  const existing = await db
    .select({
      id: libraryPurchases.id,
      expiresAt: libraryPurchases.expiresAt,
    })
    .from(libraryPurchases)
    .where(
      and(
        eq(libraryPurchases.materialId, material.id),
        eq(libraryPurchases.studentUserId, student.userId),
        isNull(libraryPurchases.revokedAt),
      ),
    );
  if (existing.some((row) => libraryExpiryStillValid(row.expiresAt))) {
    throw new ApiError(
      409,
      "CONFLICT",
      "That student already owns this material",
    );
  }
  await db
    .update(teachingMaterials)
    .set({ accessMode: "entitled", isPurchasable: true })
    .where(eq(teachingMaterials.id, material.id));
  const [created] = await db
    .insert(libraryPurchases)
    .values({
      materialId: material.id,
      studentUserId: student.userId,
      expiresAt,
      grantedByUserId: actor.userId,
    })
    .returning({ id: libraryPurchases.id });
  await writeAuditLog({
    actor,
    action: "library.purchase_assigned",
    entityType: "library_purchase",
    entityId: created?.id ?? material.id,
    ipAddress: ip,
    metadata: {
      materialId: material.id,
      studentUserId: student.userId,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
  return listLibraryPurchaseDesk(actor);
}

export async function revokeLibraryPurchase(
  actor: ApiActor,
  input: { purchaseId: string },
  ip: string,
) {
  requireManager(actor);
  const [revoked] = await db
    .update(libraryPurchases)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(libraryPurchases.id, input.purchaseId),
        isNull(libraryPurchases.revokedAt),
      ),
    )
    .returning({
      id: libraryPurchases.id,
      materialId: libraryPurchases.materialId,
    });
  if (!revoked) {
    throw new ApiError(404, "NOT_FOUND", "Purchase not found");
  }
  await writeAuditLog({
    actor,
    action: "library.purchase_revoked",
    entityType: "library_purchase",
    entityId: revoked.id,
    ipAddress: ip,
    metadata: { materialId: revoked.materialId },
  });
  return listLibraryPurchaseDesk(actor);
}
