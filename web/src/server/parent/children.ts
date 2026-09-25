import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  learningGoals,
  lessonHistory,
  parentChildren,
  roles,
  studentProfiles,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { hashPassword } from "@/server/auth/password";
import { MAX_CHILDREN_PER_PARENT } from "@/lib/parent-profile";
import {
  ageFromDateOfBirth,
  formatDateOfBirth,
  normalizeStudentLevel,
  parseDateOfBirth,
  parseSubjectInterestList,
  serializeSubjectInterestList,
  studentLevelLabel,
  studentProfileCompleteness,
} from "@/lib/student-profile";
import { normalizeTeacherGender } from "@/lib/teacher-search";
import {
  listEnabledCountries,
  listEnabledSubjects,
  resolveEnabledCountry,
  resolveSubjectInterests,
} from "@/server/student/profile";
import type {
  AddParentChildInput,
  UpdateParentChildInput,
} from "./schemas";

let unusablePasswordHash: string | undefined;

async function unusableChildPasswordHash() {
  unusablePasswordHash ??= await hashPassword(randomBytes(32).toString("base64url"));
  return unusablePasswordHash;
}

async function requireStudentRoleId() {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, "student"))
    .limit(1);
  if (!role) {
    throw new ApiError(500, "INTERNAL", "Student role is not configured");
  }
  return role.id;
}

async function countParentChildren(parentUserId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childUserId, users.id))
    .where(
      and(
        eq(parentChildren.parentUserId, parentUserId),
        isNull(users.deletedAt),
      ),
    );
  return row?.value ?? 0;
}

export async function assertParentOwnsChild(
  parentUserId: string,
  childUserId: string,
) {
  return requireLinkedChild(parentUserId, childUserId);
}

async function requireLinkedChild(parentUserId: string, childUserId: string) {
  const [link] = await db
    .select({
      id: parentChildren.id,
      isPrimary: parentChildren.isPrimary,
      parentManaged: studentProfiles.parentManaged,
    })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childUserId, users.id))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(
      and(
        eq(parentChildren.parentUserId, parentUserId),
        eq(parentChildren.childUserId, childUserId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!link) {
    throw new ApiError(404, "NOT_FOUND", "Child profile not found");
  }

  return link;
}

async function setPrimaryChild(parentUserId: string, childUserId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(parentChildren)
      .set({ isPrimary: false })
      .where(
        and(
          eq(parentChildren.parentUserId, parentUserId),
          ne(parentChildren.childUserId, childUserId),
        ),
      );
    await tx
      .update(parentChildren)
      .set({ isPrimary: true })
      .where(
        and(
          eq(parentChildren.parentUserId, parentUserId),
          eq(parentChildren.childUserId, childUserId),
        ),
      );
  });
}

async function writeLinkedChildFields(
  childUserId: string,
  input: AddParentChildInput,
  fallbackCountry?: string | null,
) {
  const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
  if (!dateOfBirth) {
    throw new ApiError(422, "VALIDATION", "Enter a valid date of birth");
  }

  const countryCode = input.country?.trim() || fallbackCountry?.trim() || "";
  const country = countryCode
    ? await resolveEnabledCountry(countryCode)
    : null;
  const subjectSlugs = await resolveSubjectInterests(input.subjectSlugs ?? []);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        displayName: input.displayName.trim(),
        country,
      })
      .where(eq(users.id, childUserId));
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
      .where(eq(studentProfiles.userId, childUserId));
  });
}

export async function listParentChildren(parentUserId: string) {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      country: users.country,
      dateOfBirth: studentProfiles.dateOfBirth,
      currentLevel: studentProfiles.currentLevel,
      subjectInterests: studentProfiles.subjectInterests,
      parentManaged: studentProfiles.parentManaged,
      isPrimary: parentChildren.isPrimary,
    })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childUserId, users.id))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(
      and(
        eq(parentChildren.parentUserId, parentUserId),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(users.displayName);

  const childIds = rows.map((row) => row.userId);
  const goalRows = childIds.length
    ? await db
        .select({
          studentUserId: learningGoals.studentUserId,
          status: learningGoals.status,
        })
        .from(learningGoals)
        .where(inArray(learningGoals.studentUserId, childIds))
    : [];
  const goalCounts = new Map<string, { total: number; active: number }>();
  for (const row of goalRows) {
    const current = goalCounts.get(row.studentUserId) ?? { total: 0, active: 0 };
    current.total += 1;
    if (row.status === "active") {
      current.active += 1;
    }
    goalCounts.set(row.studentUserId, current);
  }

  const lessonRows = childIds.length
    ? await db
        .select({
          studentUserId: lessonHistory.studentUserId,
          status: lessonHistory.status,
        })
        .from(lessonHistory)
        .where(inArray(lessonHistory.studentUserId, childIds))
    : [];
  const lessonCounts = new Map<string, { total: number; completed: number }>();
  for (const row of lessonRows) {
    const current = lessonCounts.get(row.studentUserId) ?? {
      total: 0,
      completed: 0,
    };
    current.total += 1;
    if (row.status === "completed") {
      current.completed += 1;
    }
    lessonCounts.set(row.studentUserId, current);
  }

  return rows.map((row) => {
    const subjectSlugs = parseSubjectInterestList(row.subjectInterests);
    const goals = goalCounts.get(row.userId) ?? { total: 0, active: 0 };
    const lessons = lessonCounts.get(row.userId) ?? { total: 0, completed: 0 };
    return {
      userId: row.userId,
      displayName: row.displayName,
      dateOfBirth: formatDateOfBirth(row.dateOfBirth),
      age: row.dateOfBirth ? ageFromDateOfBirth(row.dateOfBirth) : null,
      currentLevel: normalizeStudentLevel(row.currentLevel) ?? "",
      currentLevelLabel: studentLevelLabel(row.currentLevel),
      country: row.country ?? "",
      isPrimary: row.isPrimary,
      parentManaged: Boolean(row.parentManaged),
      subjectSlugs,
      goalCount: goals.total,
      activeGoalCount: goals.active,
      lessonCount: lessons.total,
      completedLessonCount: lessons.completed,
    };
  });
}

export async function getManagedParentChild(
  parentUserId: string,
  childUserId: string,
) {
  await requireLinkedChild(parentUserId, childUserId);

  const [row] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      country: users.country,
      dateOfBirth: studentProfiles.dateOfBirth,
      currentLevel: studentProfiles.currentLevel,
      languages: studentProfiles.languages,
      gender: studentProfiles.gender,
      about: studentProfiles.about,
      subjectInterests: studentProfiles.subjectInterests,
      parentManaged: studentProfiles.parentManaged,
      isPrimary: parentChildren.isPrimary,
    })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childUserId, users.id))
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(
      and(
        eq(parentChildren.parentUserId, parentUserId),
        eq(parentChildren.childUserId, childUserId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Child profile not found");
  }

  const [catalog, countries] = await Promise.all([
    listEnabledSubjects(),
    listEnabledCountries(),
  ]);
  const subjectSlugs = parseSubjectInterestList(row.subjectInterests).filter(
    (slug) => catalog.some((subject) => subject.slug === slug),
  );

  return {
    userId: row.userId,
    displayName: row.displayName,
    parentManaged: row.parentManaged,
    isPrimary: row.isPrimary,
    profile: {
      dateOfBirth: formatDateOfBirth(row.dateOfBirth),
      currentLevel: normalizeStudentLevel(row.currentLevel) ?? "",
      currentLevelLabel: studentLevelLabel(row.currentLevel),
      country: row.country ?? "",
      countryName:
        countries.find((item) => item.iso2 === row.country)?.name ?? null,
      languages: row.languages ?? "",
      gender: row.gender ?? "",
      about: row.about ?? "",
      subjectSlugs,
    },
    completeness: studentProfileCompleteness({
      dateOfBirth: row.dateOfBirth,
      currentLevel: row.currentLevel,
      country: row.country,
      subjectSlugs,
    }),
    catalog,
    countries,
  };
}

export async function addParentChild(
  actor: ApiActor,
  input: AddParentChildInput,
  ip: string,
) {
  if (actor.roleKey !== "parent") {
    throw new ApiError(403, "FORBIDDEN", "Only parents can add children");
  }

  const existing = await countParentChildren(actor.userId);
  if (existing >= MAX_CHILDREN_PER_PARENT) {
    throw new ApiError(
      422,
      "VALIDATION",
      `A family account can have up to ${MAX_CHILDREN_PER_PARENT} children.`,
    );
  }

  const [parent] = await db
    .select({ country: users.country })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  const childId = randomUUID();
  const [passwordHash, studentRoleId] = await Promise.all([
    unusableChildPasswordHash(),
    requireStudentRoleId(),
  ]);
  const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
  const countryCode = input.country?.trim() || parent?.country || "";
  const country = countryCode ? await resolveEnabledCountry(countryCode) : null;
  const subjectSlugs = await resolveSubjectInterests(input.subjectSlugs ?? []);
  const makePrimary = existing === 0;

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: childId,
      email: `child.${childId}@family.invalid`,
      passwordHash,
      displayName: input.displayName.trim(),
      roleId: studentRoleId,
      status: "active",
      country,
      emailVerifiedAt: new Date(),
    });
    await tx.insert(studentProfiles).values({
      userId: childId,
      dateOfBirth,
      currentLevel: normalizeStudentLevel(input.currentLevel),
      languages: input.languages?.trim() || null,
      gender: normalizeTeacherGender(input.gender),
      about: input.about?.trim() || null,
      subjectInterests: serializeSubjectInterestList(subjectSlugs) || null,
      parentManaged: true,
    });
    await tx.insert(parentChildren).values({
      parentUserId: actor.userId,
      childUserId: childId,
      isPrimary: makePrimary,
    });
  });

  await writeAuditLog({
    actor,
    action: "parents.child_added",
    entityType: "student_profile",
    entityId: childId,
    ipAddress: ip,
    metadata: { parentUserId: actor.userId },
  });

  return getManagedParentChild(actor.userId, childId);
}

export async function updateParentChild(
  actor: ApiActor,
  childUserId: string,
  input: UpdateParentChildInput,
  ip: string,
) {
  if (actor.roleKey !== "parent") {
    throw new ApiError(403, "FORBIDDEN", "Only parents can update children");
  }

  await requireLinkedChild(actor.userId, childUserId);
  const [parent] = await db
    .select({ country: users.country })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  await writeLinkedChildFields(childUserId, input, parent?.country);
  if (input.isPrimary) {
    await setPrimaryChild(actor.userId, childUserId);
  }

  await writeAuditLog({
    actor,
    action: "parents.child_updated",
    entityType: "student_profile",
    entityId: childUserId,
    ipAddress: ip,
    metadata: { parentUserId: actor.userId },
  });

  return getManagedParentChild(actor.userId, childUserId);
}

export async function removeParentChild(
  actor: ApiActor,
  childUserId: string,
  ip: string,
) {
  if (actor.roleKey !== "parent") {
    throw new ApiError(403, "FORBIDDEN", "Only parents can remove children");
  }

  const link = await requireLinkedChild(actor.userId, childUserId);

  await db.transaction(async (tx) => {
    await tx
      .delete(parentChildren)
      .where(
        and(
          eq(parentChildren.parentUserId, actor.userId),
          eq(parentChildren.childUserId, childUserId),
        ),
      );

    if (link.parentManaged) {
      await tx
        .update(users)
        .set({
          deletedAt: new Date(),
          status: "suspended",
        })
        .where(eq(users.id, childUserId));
    }

    if (link.isPrimary) {
      const [nextPrimary] = await tx
        .select({ childUserId: parentChildren.childUserId })
        .from(parentChildren)
        .innerJoin(users, eq(parentChildren.childUserId, users.id))
        .where(
          and(
            eq(parentChildren.parentUserId, actor.userId),
            isNull(users.deletedAt),
          ),
        )
        .orderBy(users.displayName)
        .limit(1);
      if (nextPrimary) {
        await tx
          .update(parentChildren)
          .set({ isPrimary: true })
          .where(
            and(
              eq(parentChildren.parentUserId, actor.userId),
              eq(parentChildren.childUserId, nextPrimary.childUserId),
            ),
          );
      }
    }
  });

  await writeAuditLog({
    actor,
    action: "parents.child_removed",
    entityType: "student_profile",
    entityId: childUserId,
    ipAddress: ip,
    metadata: { parentUserId: actor.userId },
  });

  return { removed: true, userId: childUserId };
}

export async function isParentManagedStudent(userId: string) {
  const [row] = await db
    .select({ parentManaged: studentProfiles.parentManaged })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);
  return Boolean(row?.parentManaged);
}
