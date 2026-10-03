import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  parentChildren,
  parentProfiles,
  roles,
  studentProfiles,
  teacherProfiles,
  users,
} from "@/db/schema";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { passwordSchema } from "@/server/auth/schemas";
import { hashPassword } from "@/server/auth/password";
import { destroyAllUserSessions } from "@/server/auth/session";

export const uatAccountPlan = [
  {
    id: "super_admin",
    email: "uat-super-admin@example.com",
    displayName: "UAT Super Admin",
    home: "/staff",
    workflow: "/staff · /staff/admins · /staff/roles · /staff/testing",
    staff: true,
  },
  {
    id: "admin",
    email: "uat-admin@example.com",
    displayName: "UAT Admin",
    home: "/staff",
    workflow: "/staff · /staff/users · /staff/bookings",
    staff: true,
  },
  {
    id: "teacher",
    email: "uat-teacher@example.com",
    displayName: "UAT Teacher",
    home: "/teach/home",
    workflow: "/teach/home · /teach/bookings · /teach/earnings · /messages",
    staff: false,
  },
  {
    id: "student",
    email: "uat-student@example.com",
    displayName: "UAT Student",
    home: "/learn",
    workflow: "/learn · /learn/bookings · /learn/homework · /messages",
    staff: false,
  },
  {
    id: "parent",
    email: "uat-parent@example.com",
    displayName: "UAT Parent",
    home: "/family",
    workflow: "/family · /family/bookings · /family/wallet · /messages",
    staff: false,
  },
  {
    id: "accounts",
    email: "uat-accounts@example.com",
    displayName: "UAT Accounts",
    home: "/staff/accounts",
    workflow: "/staff/accounts · /staff/finance",
    staff: true,
  },
  {
    id: "marketing",
    email: "uat-marketing@example.com",
    displayName: "UAT Marketing",
    home: "/staff/marketing",
    workflow: "/staff/marketing · /staff/crm",
    staff: true,
  },
  {
    id: "safeguarding",
    email: "uat-safeguarding@example.com",
    displayName: "UAT Safeguarding",
    home: "/staff/safeguarding",
    workflow: "/staff/safeguarding",
    staff: true,
  },
] as const;

export type UatRoleId = (typeof uatAccountPlan)[number]["id"];

export const uatPasswordSchema = z.object({
  roleKey: z.enum([
    "super_admin",
    "admin",
    "teacher",
    "student",
    "parent",
    "accounts",
    "marketing",
    "safeguarding",
  ]),
  password: passwordSchema,
});

function planFor(roleKey: UatRoleId) {
  const plan = uatAccountPlan.find((item) => item.id === roleKey);
  if (!plan) {
    throw new ApiError(404, "NOT_FOUND", "That UAT role is not listed");
  }
  return plan;
}

export async function ensureUatAccounts() {
  const created: UatRoleId[] = [];
  const hashes = new Map<UatRoleId, string>();
  for (const plan of uatAccountPlan) {
    hashes.set(plan.id, await hashPassword(randomBytes(32).toString("base64url")));
  }

  await db.transaction(async (tx) => {
    const roleRows = await tx.select({ id: roles.id, key: roles.key }).from(roles);
    const roleId = new Map(roleRows.map((row) => [row.key, row.id]));

    for (const plan of uatAccountPlan) {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, plan.email))
        .limit(1);
      if (existing) continue;

      const assignedRole = roleId.get(plan.id);
      if (!assignedRole) {
        throw new ApiError(500, "INTERNAL", "A UAT role is missing from the catalogue");
      }

      const [user] = await tx
        .insert(users)
        .values({
          email: plan.email,
          passwordHash: hashes.get(plan.id)!,
          displayName: plan.displayName,
          roleId: assignedRole,
          status: "active",
          locale: "en",
          currency: "GBP",
          timezone: "Europe/London",
          country: "GB",
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
      if (!user) {
        throw new ApiError(500, "INTERNAL", "Could not create the UAT account");
      }

      if (plan.id === "teacher") {
        await tx.insert(teacherProfiles).values({
          userId: user.id,
          verificationStatus: "approved",
          headline: "UAT teacher",
          currencyCode: "GBP",
          hourlyRateMinor: 2000,
          reviewedAt: new Date(),
        });
      } else if (plan.id === "student") {
        await tx.insert(studentProfiles).values({
          userId: user.id,
          dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
          parentManaged: false,
        });
      } else if (plan.id === "parent") {
        await tx.insert(parentProfiles).values({
          userId: user.id,
          dateOfBirth: new Date("1985-01-01T00:00:00.000Z"),
          relationship: "parent",
        });
      }

      created.push(plan.id);
    }

    const [parent] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "uat-parent@example.com"))
      .limit(1);
    const [student] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "uat-student@example.com"))
      .limit(1);
    if (parent && student) {
      const [link] = await tx
        .select({ id: parentChildren.id })
        .from(parentChildren)
        .where(
          and(
            eq(parentChildren.parentUserId, parent.id),
            eq(parentChildren.childUserId, student.id),
          ),
        )
        .limit(1);
      if (!link) {
        await tx.insert(parentChildren).values({
          parentUserId: parent.id,
          childUserId: student.id,
          isPrimary: true,
        });
      }
    }
  });

  return created;
}

export async function setUatPassword(
  actor: ApiActor,
  input: z.infer<typeof uatPasswordSchema>,
  ip?: string,
) {
  if (!hasAnyPermission(actor, "users.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot set a UAT password");
  }
  if (input.roleKey === "super_admin" && actor.roleKey !== "super_admin") {
    throw new ApiError(403, "FORBIDDEN", "Only a Super Admin can set that password");
  }

  const plan = planFor(input.roleKey);
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, plan.email), isNull(users.deletedAt)))
    .limit(1);
  if (!account) {
    throw new ApiError(404, "NOT_FOUND", "That UAT account is not on file");
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.password) })
    .where(eq(users.id, account.id));
  await destroyAllUserSessions(account.id);
  await writeAuditLog({
    actor,
    action: "users.uat_password_set",
    entityType: "user",
    entityId: account.id,
    ipAddress: ip,
    metadata: { roleKey: input.roleKey },
  });
  return { updated: true };
}
