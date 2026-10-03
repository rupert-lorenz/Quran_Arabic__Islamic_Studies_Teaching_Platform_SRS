import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  parentChildren,
  parentProfiles,
  privacyConsents,
  roles,
  studentProfiles,
  users,
} from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { hashPassword } from "@/server/auth/password";
import { destroyAllUserSessions } from "@/server/auth/session";
import { randomBytes } from "node:crypto";

export const consentSchema = z.object({
  kind: z.enum(["privacy", "marketing"]),
  granted: z.boolean(),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal("delete my account"),
});

async function studentGate(userId: string) {
  const [profile] = await db
    .select({
      parentManaged: studentProfiles.parentManaged,
      dateOfBirth: studentProfiles.dateOfBirth,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export async function setPrivacyConsent(
  actor: ApiActor,
  input: z.infer<typeof consentSchema>,
  ip?: string,
) {
  if (actor.roleKey === "student") {
    const profile = await studentGate(actor.userId);
    if (input.kind === "marketing") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Student accounts cannot opt in to marketing",
      );
    }
    if (profile?.parentManaged) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "A parent records privacy choices for this child account",
      );
    }
  }

  if (input.kind === "marketing" && input.granted && !(await marketingAllowed(actor))) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Marketing is not offered for this account",
    );
  }

  const now = new Date();
  await db
    .insert(privacyConsents)
    .values({
      userId: actor.userId,
      kind: input.kind,
      granted: input.granted,
      recordedAt: now,
    })
    .onConflictDoUpdate({
      target: [privacyConsents.userId, privacyConsents.kind],
      set: { granted: input.granted, recordedAt: now },
    });

  await writeAuditLog({
    actor,
    action: input.granted ? "privacy.consent.granted" : "privacy.consent.withdrawn",
    entityType: "privacy_consent",
    entityId: actor.userId,
    metadata: { kind: input.kind },
    ipAddress: ip,
  });

  return { kind: input.kind, granted: input.granted, recordedAt: now };
}

export async function deleteOwnAccount(actor: ApiActor, ip?: string) {
  if (actor.roleKey === "student") {
    const profile = await studentGate(actor.userId);
    if (profile?.parentManaged) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "A parent removes this child from the family page",
      );
    }
  }

  if (actor.roleKey === "super_admin") {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(roles.key, "super_admin"), isNull(users.deletedAt)));
    if (admins.length <= 1) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "The last super admin account cannot be deleted",
      );
    }
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      deletedAt: now,
      status: "suspended",
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
    })
    .where(eq(users.id, actor.userId));
  await db
    .insert(privacyConsents)
    .values({
      userId: actor.userId,
      kind: "marketing",
      granted: false,
      recordedAt: now,
    })
    .onConflictDoUpdate({
      target: [privacyConsents.userId, privacyConsents.kind],
      set: { granted: false, recordedAt: now },
    });
  await destroyAllUserSessions(actor.userId);

  await writeAuditLog({
    actor,
    action: "account.deleted",
    entityType: "user",
    entityId: actor.userId,
    ipAddress: ip,
  });

  return { deleted: true };
}

export async function marketingAllowed(actor: ApiActor) {
  if (actor.roleKey === "student") return false;
  const student = await studentGate(actor.userId);
  if (student?.dateOfBirth && isUnder18(student.dateOfBirth)) return false;
  const [parent] = await db
    .select({ dateOfBirth: parentProfiles.dateOfBirth })
    .from(parentProfiles)
    .where(eq(parentProfiles.userId, actor.userId))
    .limit(1);
  if (parent?.dateOfBirth && isUnder18(parent.dateOfBirth)) return false;
  return true;
}

export function isUnder18(dateOfBirth: Date) {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  return dateOfBirth.getTime() > cutoff.getTime();
}

export async function linkedChildCount(parentUserId: string) {
  const rows = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, parentUserId));
  return rows.length;
}
