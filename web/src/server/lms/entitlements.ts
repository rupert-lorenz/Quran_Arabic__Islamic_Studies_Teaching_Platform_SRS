import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  groupLessonEnrollments,
  groupLessons,
  libraryLicencePools,
  libraryLicenceSeats,
  librarySubscriptionPlans,
  librarySubscriptions,
  liveCourseEnrollments,
  liveCourses,
  parentChildren,
  studentProfiles,
  teachingMaterialAccessRules,
  teachingMaterialGrants,
  teachingMaterials,
  users,
} from "@/db/schema";
import {
  LIBRARY_GRANT_SOURCES,
  LIBRARY_ROLE_REFS,
  LIBRARY_RULE_TYPES,
  libraryExpiryStillValid,
  type LibraryAccessMode,
  type LibraryGrantSource,
  type LibraryLockReason,
  type LibraryRoleRef,
  type LibraryRuleType,
  type TeachingMaterialAudience,
  type TeachingMaterialCategory,
} from "@/lib/library-materials";
import {
  assignLicenceSeat,
  createLicencePool,
  loadLicenceCoverage,
} from "./licences";
import { loadLearnerPurchases } from "./purchases";
import {
  loadPublishedPrerecordedLessonIds,
  loadUnlockedPrerecordedMaterialIds,
} from "./prerecorded-courses";
import { loadLearnerRentalWindows, rentalIsActive } from "./rentals";
import {
  assignLibrarySubscriptionSeat,
  createSubscriptionPlan,
  loadSubscriptionCoverage,
} from "./subscriptions";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { findUserByEmail } from "@/server/staff/lookup";

const ACTIVE_ENROLLMENT = ["confirmed", "completed"] as const;

export type LibraryAccessDecision = {
  accessMode: LibraryAccessMode;
  entitled: boolean;
  isLocked: boolean;
  lockReason: LibraryLockReason | null;
};

export type LibraryAccessCatalog = {
  liveCourses: Array<{ id: string; title: string }>;
  groupLessons: Array<{ id: string; title: string }>;
  plans: Array<{ key: string; name: string }>;
  pools: Array<{ key: string; name: string }>;
};

export type LibraryAccessRuleView = {
  id: string;
  ruleType: LibraryRuleType;
  ruleRef: string;
  label: string;
};

export type LibraryGrantView = {
  id: string;
  studentUserId: string;
  studentName: string;
  source: LibraryGrantSource;
  expiresAt: string | null;
};

function canManageLibrary(actor: ApiActor) {
  return hasAnyPermission(actor, "academic.curriculum");
}

function skipEntitlement(actor: ApiActor, createdByUserId: string | null) {
  return canManageLibrary(actor) || createdByUserId === actor.userId;
}

function previewsEntitled(actor: ApiActor) {
  return actor.roleKey === "teacher" || isStaffRole(actor.roleKey);
}

function stillValid(expiresAt: Date | null, revokedAt?: Date | null) {
  if (revokedAt) return false;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

function roleMatches(actor: ApiActor, ref: string) {
  if (ref === "staff") return isStaffRole(actor.roleKey);
  if (ref === "student") {
    return actor.roleKey === "student" || actor.roleKey === "parent";
  }
  return actor.roleKey === ref;
}

function lockReasonFromRules(
  rules: Array<{ ruleType: LibraryRuleType }>,
): LibraryLockReason {
  const types = new Set(rules.map((rule) => rule.ruleType));
  if (types.has("live_course") || types.has("group_lesson")) return "course";
  if (types.has("subscription")) return "subscription";
  if (types.has("licence")) return "licence";
  if (types.has("purchase")) return "purchase";
  return "contact";
}

export async function learnerIdsForActor(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => child.id);
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

function requireManager(actor: ApiActor) {
  if (!canManageLibrary(actor)) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage library access");
  }
}

export async function listLibraryAccessCatalog(): Promise<LibraryAccessCatalog> {
  const [courses, lessons, plans, pools] = await Promise.all([
    db
      .select({ id: liveCourses.id, title: liveCourses.title })
      .from(liveCourses)
      .where(eq(liveCourses.status, "published"))
      .orderBy(desc(liveCourses.firstStartsAt))
      .limit(80),
    db
      .select({ id: groupLessons.id, title: groupLessons.title })
      .from(groupLessons)
      .where(eq(groupLessons.status, "published"))
      .orderBy(desc(groupLessons.startsAt))
      .limit(80),
    db
      .select({
        key: librarySubscriptionPlans.key,
        name: librarySubscriptionPlans.name,
      })
      .from(librarySubscriptionPlans)
      .where(eq(librarySubscriptionPlans.isEnabled, true))
      .orderBy(librarySubscriptionPlans.name),
    db
      .select({
        key: libraryLicencePools.key,
        name: libraryLicencePools.name,
      })
      .from(libraryLicencePools)
      .where(eq(libraryLicencePools.isEnabled, true))
      .orderBy(libraryLicencePools.name),
  ]);
  return {
    liveCourses: courses,
    groupLessons: lessons,
    plans,
    pools,
  };
}

export async function resolveLibraryAccess(
  actor: ApiActor,
  materials: Array<{
    id: string;
    accessMode: LibraryAccessMode;
    createdByUserId: string | null;
    rentalDays?: number | null;
    isPurchasable?: boolean | null;
  }>,
) {
  const decisions = new Map<string, LibraryAccessDecision>();
  if (!materials.length) return decisions;

  const learnerIds = await learnerIdsForActor(actor);
  const entitledIds = materials
    .filter((item) => item.accessMode === "entitled")
    .map((item) => item.id);

  const [rules, grants, enrollments, subscriptions, seats, coverage, planCoverage, rentals, purchases, courseUnlocks, courseLessons] = entitledIds.length
    ? await Promise.all([
        db
          .select({
            materialId: teachingMaterialAccessRules.materialId,
            ruleType: teachingMaterialAccessRules.ruleType,
            ruleRef: teachingMaterialAccessRules.ruleRef,
          })
          .from(teachingMaterialAccessRules)
          .where(inArray(teachingMaterialAccessRules.materialId, entitledIds)),
        learnerIds.length
          ? db
              .select({
                materialId: teachingMaterialGrants.materialId,
                studentUserId: teachingMaterialGrants.studentUserId,
                source: teachingMaterialGrants.source,
                expiresAt: teachingMaterialGrants.expiresAt,
                revokedAt: teachingMaterialGrants.revokedAt,
              })
              .from(teachingMaterialGrants)
              .where(
                and(
                  inArray(teachingMaterialGrants.materialId, entitledIds),
                  inArray(teachingMaterialGrants.studentUserId, learnerIds),
                  isNull(teachingMaterialGrants.revokedAt),
                ),
              )
          : Promise.resolve([]),
        learnerIds.length
          ? loadLearnerEnrollments(learnerIds)
          : Promise.resolve({
              liveCourses: new Set<string>(),
              groupLessons: new Set<string>(),
            }),
        learnerIds.length
          ? loadLearnerSubscriptions(learnerIds)
          : Promise.resolve(new Set<string>()),
        learnerIds.length
          ? loadLearnerLicences(learnerIds)
          : Promise.resolve([] as Array<{ poolKey: string; materialId: string | null }>),
        loadLicenceCoverage(entitledIds),
        loadSubscriptionCoverage(entitledIds),
        learnerIds.length
          ? loadLearnerRentalWindows(learnerIds)
          : Promise.resolve([]),
        learnerIds.length
          ? loadLearnerPurchases(learnerIds)
          : Promise.resolve([]),
        learnerIds.length
          ? loadUnlockedPrerecordedMaterialIds(learnerIds)
          : Promise.resolve(new Set<string>()),
        loadPublishedPrerecordedLessonIds(entitledIds),
      ])
    : [[], [], { liveCourses: new Set<string>(), groupLessons: new Set<string>() }, new Set<string>(), [], [], [], [], [], new Set<string>(), new Set<string>()];

  const rulesByMaterial = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = rulesByMaterial.get(rule.materialId) ?? [];
    list.push(rule);
    rulesByMaterial.set(rule.materialId, list);
  }

  for (const material of materials) {
    if (skipEntitlement(actor, material.createdByUserId) || previewsEntitled(actor)) {
      decisions.set(material.id, {
        accessMode: material.accessMode,
        entitled: true,
        isLocked: false,
        lockReason: null,
      });
      continue;
    }
    if (material.accessMode !== "entitled") {
      decisions.set(material.id, {
        accessMode: material.accessMode,
        entitled: true,
        isLocked: false,
        lockReason: null,
      });
      continue;
    }

    const materialRules = rulesByMaterial.get(material.id) ?? [];
    const coveredBy = coverage.filter((item) => item.materialId === material.id);
    const coveredByPlans = planCoverage.filter((item) => item.materialId === material.id);
    const hasSubscriptionCover = coveredByPlans.some((item) =>
      subscriptions.has(item.planKey),
    );
    const hasLicence = seats.some((seat) => {
      if (seat.materialId === material.id) return true;
      if (seat.materialId) return false;
      const covered = coveredBy.filter((item) => item.poolKey === seat.poolKey);
      if (covered.length) return true;
      return materialRules.some(
        (rule) => rule.ruleType === "licence" && rule.ruleRef === seat.poolKey,
      );
    });
    const hasGrant = grants.some(
      (grant) =>
        grant.materialId === material.id &&
        stillValid(grant.expiresAt, grant.revokedAt),
    );
    const materialRentals = rentals.filter((item) => item.materialId === material.id);
    const hasRental = materialRentals.some((item) =>
      rentalIsActive(item.startsAt, item.expiresAt, item.revokedAt),
    );
    const materialPurchases = purchases.filter((item) => item.materialId === material.id);
    const hasPurchase = materialPurchases.some((item) =>
      libraryExpiryStillValid(item.expiresAt, item.revokedAt),
    );
    const hasPrerecorded = courseUnlocks.has(material.id);
    const entitled =
      hasGrant ||
      hasRental ||
      hasLicence ||
      hasSubscriptionCover ||
      hasPurchase ||
      hasPrerecorded ||
      materialRules.some((rule) => {
        if (rule.ruleType === "role") return roleMatches(actor, rule.ruleRef);
        if (rule.ruleType === "live_course") {
          return enrollments.liveCourses.has(rule.ruleRef);
        }
        if (rule.ruleType === "group_lesson") {
          return enrollments.groupLessons.has(rule.ruleRef);
        }
        if (rule.ruleType === "subscription") {
          return subscriptions.has(rule.ruleRef);
        }
        if (rule.ruleType === "licence") {
          return seats.some(
            (seat) =>
              seat.poolKey === rule.ruleRef &&
              (!seat.materialId || seat.materialId === material.id),
          );
        }
        if (rule.ruleType === "purchase") {
          return grants.some(
            (grant) =>
              grant.materialId === material.id &&
              grant.source === "purchase" &&
              stillValid(grant.expiresAt, grant.revokedAt),
          );
        }
        return false;
      });

    decisions.set(material.id, {
      accessMode: material.accessMode,
      entitled,
      isLocked: !entitled,
      lockReason: entitled
        ? null
        : material.rentalDays || materialRentals.length
          ? "rental"
          : coveredByPlans.length
            ? "subscription"
            : coveredBy.length
              ? "licence"
              : material.isPurchasable || materialPurchases.length
                ? "purchase"
                : courseLessons.has(material.id)
                  ? "course"
                  : lockReasonFromRules(materialRules),
    });
  }

  return decisions;
}

async function loadLearnerEnrollments(learnerIds: string[]) {
  const [courses, lessons] = await Promise.all([
    db
      .select({ id: liveCourseEnrollments.liveCourseId })
      .from(liveCourseEnrollments)
      .where(
        and(
          inArray(liveCourseEnrollments.studentUserId, learnerIds),
          inArray(liveCourseEnrollments.status, [...ACTIVE_ENROLLMENT]),
        ),
      ),
    db
      .select({ id: groupLessonEnrollments.groupLessonId })
      .from(groupLessonEnrollments)
      .where(
        and(
          inArray(groupLessonEnrollments.studentUserId, learnerIds),
          inArray(groupLessonEnrollments.status, [...ACTIVE_ENROLLMENT]),
        ),
      ),
  ]);
  return {
    liveCourses: new Set(courses.map((row) => row.id)),
    groupLessons: new Set(lessons.map((row) => row.id)),
  };
}

async function loadLearnerSubscriptions(learnerIds: string[]) {
  const rows = await db
    .select({
      planKey: librarySubscriptions.planKey,
      startsAt: librarySubscriptions.startsAt,
      expiresAt: librarySubscriptions.expiresAt,
      isEnabled: librarySubscriptionPlans.isEnabled,
    })
    .from(librarySubscriptions)
    .innerJoin(
      librarySubscriptionPlans,
      eq(librarySubscriptionPlans.key, librarySubscriptions.planKey),
    )
    .where(
      and(
        inArray(librarySubscriptions.studentUserId, learnerIds),
        eq(librarySubscriptions.status, "active"),
      ),
    );
  return new Set(
    rows
      .filter(
        (row) =>
          row.isEnabled &&
          row.startsAt.getTime() <= Date.now() &&
          stillValid(row.expiresAt),
      )
      .map((row) => row.planKey),
  );
}

async function loadLearnerLicences(learnerIds: string[]) {
  const rows = await db
    .select({
      poolKey: libraryLicenceSeats.poolKey,
      materialId: libraryLicenceSeats.materialId,
      expiresAt: libraryLicenceSeats.expiresAt,
      revokedAt: libraryLicenceSeats.revokedAt,
    })
    .from(libraryLicenceSeats)
    .where(inArray(libraryLicenceSeats.studentUserId, learnerIds));
  return rows
    .filter((row) => stillValid(row.expiresAt, row.revokedAt))
    .map((row) => ({ poolKey: row.poolKey, materialId: row.materialId }));
}

export async function getMaterialAccess(
  actor: ApiActor,
  materialId: string,
) {
  requireManager(actor);
  const [material] = await db
    .select({
      id: teachingMaterials.id,
      category: teachingMaterials.category,
      accessMode: teachingMaterials.accessMode,
    })
    .from(teachingMaterials)
    .where(eq(teachingMaterials.id, materialId))
    .limit(1);
  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }

  const [rules, grants, catalog] = await Promise.all([
    db
      .select()
      .from(teachingMaterialAccessRules)
      .where(eq(teachingMaterialAccessRules.materialId, materialId)),
    db
      .select({
        id: teachingMaterialGrants.id,
        studentUserId: teachingMaterialGrants.studentUserId,
        studentName: users.displayName,
        source: teachingMaterialGrants.source,
        expiresAt: teachingMaterialGrants.expiresAt,
      })
      .from(teachingMaterialGrants)
      .innerJoin(users, eq(users.id, teachingMaterialGrants.studentUserId))
      .where(
        and(
          eq(teachingMaterialGrants.materialId, materialId),
          isNull(teachingMaterialGrants.revokedAt),
        ),
      )
      .orderBy(desc(teachingMaterialGrants.createdAt)),
    listLibraryAccessCatalog(),
  ]);

  return {
    accessMode: material.accessMode,
    category: material.category,
    rules: rules.map((rule) => ({
      id: rule.id,
      ruleType: rule.ruleType,
      ruleRef: rule.ruleRef,
      label: ruleLabel(rule.ruleType, rule.ruleRef, catalog),
    })) satisfies LibraryAccessRuleView[],
    grants: grants.map((grant) => ({
      id: grant.id,
      studentUserId: grant.studentUserId,
      studentName: grant.studentName,
      source: grant.source,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
    })) satisfies LibraryGrantView[],
    catalog,
  };
}

function ruleLabel(
  type: LibraryRuleType,
  ref: string,
  catalog: LibraryAccessCatalog,
) {
  if (type === "role") return ref;
  if (type === "live_course") {
    return catalog.liveCourses.find((item) => item.id === ref)?.title ?? ref;
  }
  if (type === "group_lesson") {
    return catalog.groupLessons.find((item) => item.id === ref)?.title ?? ref;
  }
  if (type === "subscription") {
    return catalog.plans.find((item) => item.key === ref)?.name ?? ref;
  }
  if (type === "licence") {
    return catalog.pools.find((item) => item.key === ref)?.name ?? ref;
  }
  return "Purchase grant";
}

export async function addMaterialAccessRule(
  actor: ApiActor,
  materialId: string,
  input: { ruleType: LibraryRuleType; ruleRef: string },
  ip: string,
) {
  requireManager(actor);
  const [material] = await db
    .select({
      id: teachingMaterials.id,
      category: teachingMaterials.category,
      audience: teachingMaterials.audience,
    })
    .from(teachingMaterials)
    .where(eq(teachingMaterials.id, materialId))
    .limit(1);
  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (!LIBRARY_RULE_TYPES.includes(input.ruleType)) {
    throw new ApiError(422, "VALIDATION", "Choose a valid access rule");
  }
  const ruleRef = input.ruleRef.trim();
  if (!ruleRef && input.ruleType !== "purchase") {
    throw new ApiError(422, "VALIDATION", "Choose what this rule unlocks");
  }
  await assertRuleRef(material, input.ruleType, ruleRef || "purchase");

  try {
    await db.insert(teachingMaterialAccessRules).values({
      materialId,
      ruleType: input.ruleType,
      ruleRef: ruleRef || "purchase",
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That access rule is already on this material");
  }

  await writeAuditLog({
    actor,
    action: "library.access_rule_added",
    entityType: "teaching_material",
    entityId: materialId,
    ipAddress: ip,
    metadata: input,
  });
  return getMaterialAccess(actor, materialId);
}

async function assertRuleRef(
  material: {
    category: TeachingMaterialCategory;
    audience: TeachingMaterialAudience;
  },
  ruleType: LibraryRuleType,
  ruleRef: string,
) {
  if (material.category === "teacher_guide" && ruleType === "role" && ruleRef === "student") {
    throw new ApiError(
      422,
      "VALIDATION",
      "Teacher guides stay with teachers and staff",
    );
  }
  if (ruleType === "role") {
    if (!(LIBRARY_ROLE_REFS as readonly string[]).includes(ruleRef)) {
      throw new ApiError(422, "VALIDATION", "Choose a valid role");
    }
    if (material.audience === "teachers" && ruleRef === "student") {
      throw new ApiError(
        422,
        "VALIDATION",
        "This material is not for students",
      );
    }
    return;
  }
  if (ruleType === "purchase") return;
  if (ruleType === "live_course") {
    const [course] = await db
      .select({ id: liveCourses.id })
      .from(liveCourses)
      .where(eq(liveCourses.id, ruleRef))
      .limit(1);
    if (!course) throw new ApiError(404, "NOT_FOUND", "Live course not found");
    return;
  }
  if (ruleType === "group_lesson") {
    const [lesson] = await db
      .select({ id: groupLessons.id })
      .from(groupLessons)
      .where(eq(groupLessons.id, ruleRef))
      .limit(1);
    if (!lesson) throw new ApiError(404, "NOT_FOUND", "Group lesson not found");
    return;
  }
  if (ruleType === "subscription") {
    const [plan] = await db
      .select({ key: librarySubscriptionPlans.key })
      .from(librarySubscriptionPlans)
      .where(eq(librarySubscriptionPlans.key, ruleRef))
      .limit(1);
    if (!plan) throw new ApiError(404, "NOT_FOUND", "Subscription plan not found");
    return;
  }
  const [pool] = await db
    .select({ key: libraryLicencePools.key })
    .from(libraryLicencePools)
    .where(eq(libraryLicencePools.key, ruleRef))
    .limit(1);
  if (!pool) throw new ApiError(404, "NOT_FOUND", "Licence pool not found");
}

export async function removeMaterialAccessRule(
  actor: ApiActor,
  materialId: string,
  ruleId: string,
  ip: string,
) {
  requireManager(actor);
  const [removed] = await db
    .delete(teachingMaterialAccessRules)
    .where(
      and(
        eq(teachingMaterialAccessRules.id, ruleId),
        eq(teachingMaterialAccessRules.materialId, materialId),
      ),
    )
    .returning({ id: teachingMaterialAccessRules.id });
  if (!removed) {
    throw new ApiError(404, "NOT_FOUND", "Access rule not found");
  }
  await writeAuditLog({
    actor,
    action: "library.access_rule_removed",
    entityType: "teaching_material",
    entityId: materialId,
    ipAddress: ip,
    metadata: { ruleId },
  });
  return getMaterialAccess(actor, materialId);
}

export async function grantMaterialAccess(
  actor: ApiActor,
  materialId: string,
  input: {
    email: string;
    source: LibraryGrantSource;
    expiresAt?: string;
  },
  ip: string,
) {
  requireManager(actor);
  if (!LIBRARY_GRANT_SOURCES.includes(input.source)) {
    throw new ApiError(422, "VALIDATION", "Choose a valid access source");
  }
  const [material] = await db
    .select({
      id: teachingMaterials.id,
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
      "Student grants are only for learner materials",
    );
  }
  const student = await requireStudentByEmail(input.email);
  const expiresAt = parseOptionalDate(input.expiresAt);

  await db.insert(teachingMaterialGrants).values({
    materialId,
    studentUserId: student.userId,
    source: input.source,
    grantedByUserId: actor.userId,
    expiresAt,
  });

  await writeAuditLog({
    actor,
    action: "library.access_granted",
    entityType: "teaching_material",
    entityId: materialId,
    ipAddress: ip,
    metadata: { studentUserId: student.userId, source: input.source },
  });
  return getMaterialAccess(actor, materialId);
}

export async function revokeMaterialAccess(
  actor: ApiActor,
  materialId: string,
  grantId: string,
  ip: string,
) {
  requireManager(actor);
  const [updated] = await db
    .update(teachingMaterialGrants)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(teachingMaterialGrants.id, grantId),
        eq(teachingMaterialGrants.materialId, materialId),
        isNull(teachingMaterialGrants.revokedAt),
      ),
    )
    .returning({ id: teachingMaterialGrants.id });
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Access grant not found");
  }
  await writeAuditLog({
    actor,
    action: "library.access_revoked",
    entityType: "teaching_material",
    entityId: materialId,
    ipAddress: ip,
    metadata: { grantId },
  });
  return getMaterialAccess(actor, materialId);
}

export async function createLibraryPlan(
  actor: ApiActor,
  input: { key: string; name: string; description?: string },
  ip: string,
) {
  await createSubscriptionPlan(actor, input, ip);
  return listLibraryAccessCatalog();
}

export async function createLibraryLicencePool(
  actor: ApiActor,
  input: { key: string; name: string; description?: string },
  ip: string,
) {
  await createLicencePool(actor, input, ip);
  return listLibraryAccessCatalog();
}

export async function assignLibrarySubscription(
  actor: ApiActor,
  input: { email: string; planKey: string; expiresAt?: string },
  ip: string,
) {
  await assignLibrarySubscriptionSeat(actor, input, ip);
  return { assigned: true };
}

export async function assignLibraryLicence(
  actor: ApiActor,
  input: {
    email: string;
    poolKey: string;
    materialId?: string;
    expiresAt?: string;
  },
  ip: string,
) {
  await assignLicenceSeat(actor, input, ip);
  return listLibraryAccessCatalog();
}

function parseOptionalDate(value?: string) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid expiry date");
  }
  return date;
}

export function canManageLibraryAccess(actor: ApiActor) {
  return canManageLibrary(actor);
}

export type { LibraryRoleRef };
