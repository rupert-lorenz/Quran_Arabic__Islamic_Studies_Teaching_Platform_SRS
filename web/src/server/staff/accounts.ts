import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  parentProfiles,
  roles,
  studentProfiles,
  teacherProfiles,
  users,
} from "@/db/schema";
import { assignableStaffRoles, type RoleKey, staffRoles } from "@/lib/rbac";
import { writeAuditLog } from "@/server/api/audit";
import type { ApiActor } from "@/server/api/auth";
import { ApiError, isApiError } from "@/server/api/errors";
import { hasAnyPermission } from "@/lib/rbac";
import { resetUserPermissionsToRole } from "@/server/rbac/user-permissions";
import { hashPassword, normalizeEmail } from "@/server/auth/password";
import { sendAccountEmail } from "@/server/auth/mail";
import { destroyAllUserSessions, loadUserById } from "@/server/auth/session";
import { withLock } from "@/redis/locks";
import { finalizeSignIn } from "@/server/auth/login";

export async function hasSuperAdmin() {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.key, "super_admin"), isNull(users.deletedAt)))
    .limit(1);

  return Boolean(row);
}

export async function countActiveSuperAdmins() {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(roles.key, "super_admin"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );

  return rows.length;
}

export async function listDirectory(limit = 100) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      roleKey: roles.key,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      customPermissions: users.customPermissions,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(isNull(users.deletedAt))
    .orderBy(desc(users.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    emailVerified: Boolean(row.emailVerifiedAt),
  }));
}

export async function bootstrapSuperAdmin(input: {
  email: string;
  password: string;
  displayName: string;
  ip: string;
  userAgent: string;
}) {
  const work = async () => {
    if (await hasSuperAdmin()) {
      throw new ApiError(
        409,
        "SETUP_COMPLETE",
        "A Super Admin account already exists",
      );
    }

    const user = await insertStaffUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      roleKey: "super_admin",
    });

    await writeAuditLog({
      actor: { userId: user.id, roleKey: "super_admin", permissions: [] },
      action: "users.super_admin_bootstrapped",
      entityType: "user",
      entityId: user.id,
      ipAddress: input.ip,
    });

    return finalizeSignIn(user, { ip: input.ip, userAgent: input.userAgent });
  };

  try {
    return await withLock("bootstrap-super-admin", 15_000, work);
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    if (isApiLockError(error)) {
      throw new ApiError(
        409,
        "SETUP_IN_PROGRESS",
        "Super Admin setup is already in progress",
      );
    }
    return work();
  }
}

export async function createStaffUser(
  actor: ApiActor,
  input: {
    email: string;
    password: string;
    displayName: string;
    roleKey: (typeof staffRoles)[number];
    ip: string;
  },
) {
  if (!assignableStaffRoles(actor.roleKey).includes(input.roleKey)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You cannot assign this staff role",
    );
  }

  const user = await insertStaffUser(input);

  await sendAccountEmail({
    to: user.email,
    subject: "Your staff account is ready",
    text: "Sign in with the email and password you were given, then set up two-factor authentication before using staff tools.",
  });

  await writeAuditLog({
    actor,
    action: "users.staff_created",
    entityType: "user",
    entityId: user.id,
    ipAddress: input.ip,
    metadata: { roleKey: input.roleKey },
  });

  return directoryUser(user.id);
}

export async function updateDirectoryUser(
  actor: ApiActor,
  userId: string,
  input: {
    displayName?: string;
    roleKey?: RoleKey;
    status?: "active" | "suspended";
    ip: string;
  },
) {
  const current = await loadDirectoryUser(userId);
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  if (input.displayName || input.roleKey) {
    if (!hasAnyPermission(actor, "users.write")) {
      throw new ApiError(403, "FORBIDDEN", "You cannot change this account");
    }
  }

  if (input.status) {
    if (!hasAnyPermission(actor, "users.suspend")) {
      throw new ApiError(403, "FORBIDDEN", "You cannot change account status");
    }
  }

  if (current.id === actor.userId && input.roleKey && input.roleKey !== current.roleKey) {
    throw new ApiError(400, "ROLE_LOCKED", "You cannot change your own role");
  }

  if (current.id === actor.userId && input.status === "suspended") {
    throw new ApiError(400, "STATUS_LOCKED", "You cannot suspend your own account");
  }

  if (current.roleKey === "super_admin" && actor.roleKey !== "super_admin") {
    throw new ApiError(403, "FORBIDDEN", "Only Super Admin can change Super Admin accounts");
  }

  if (input.roleKey === "super_admin" && actor.roleKey !== "super_admin") {
    throw new ApiError(403, "FORBIDDEN", "Only Super Admin can assign Super Admin");
  }

  const activeSuperAdmins = await countActiveSuperAdmins();
  const isLastSuperAdmin =
    current.roleKey === "super_admin" &&
    current.status === "active" &&
    activeSuperAdmins <= 1;

  if (isLastSuperAdmin && input.roleKey && input.roleKey !== "super_admin") {
    throw new ApiError(
      400,
      "ROLE_LOCKED",
      "The last Super Admin cannot be assigned another role",
    );
  }

  if (isLastSuperAdmin && input.status === "suspended") {
    throw new ApiError(
      400,
      "STATUS_LOCKED",
      "The last Super Admin cannot be suspended",
    );
  }

  const [role] = input.roleKey
    ? await db.select().from(roles).where(eq(roles.key, input.roleKey)).limit(1)
    : [];

  if (input.roleKey && !role) {
    throw new ApiError(404, "NOT_FOUND", "Role not found");
  }

  await db
    .update(users)
    .set({
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(role ? { roleId: role.id } : {}),
      ...(input.status ? { status: input.status } : {}),
    })
    .where(eq(users.id, current.id));

  if (input.roleKey && isMarketplaceRole(input.roleKey)) {
    await ensureMarketplaceProfile(current.id, input.roleKey);
  }

  if (input.roleKey && input.roleKey !== current.roleKey) {
    await resetUserPermissionsToRole(current.id);
  }

  if (input.roleKey || input.status === "suspended") {
    await destroyAllUserSessions(current.id);
  }

  await writeAuditLog({
    actor,
    action: input.status
      ? input.status === "suspended"
        ? "users.suspended"
        : "users.restored"
      : "users.updated",
    entityType: "user",
    entityId: current.id,
    ipAddress: input.ip,
    metadata: {
      roleKey: input.roleKey,
      status: input.status,
      displayName: input.displayName,
    },
  });

  return directoryUser(current.id);
}

async function insertStaffUser(input: {
  email: string;
  password: string;
  displayName: string;
  roleKey: (typeof staffRoles)[number];
}) {
  const email = normalizeEmail(input.email);
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.key, input.roleKey))
    .limit(1);

  if (!role) {
    throw new ApiError(404, "NOT_FOUND", "Role not found");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName.trim(),
      roleId: role.id,
      status: "active",
      emailVerifiedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create account");
  }

  const user = await loadUserById(created.id);
  if (!user) {
    throw new ApiError(500, "INTERNAL", "Could not load the new account");
  }

  return user;
}

async function loadDirectoryUser(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      roleKey: roles.key,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      customPermissions: users.customPermissions,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.deletedAt) {
    return null;
  }

  return row;
}

async function directoryUser(userId: string) {
  const row = await loadDirectoryUser(userId);
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    roleKey: row.roleKey,
    emailVerified: Boolean(row.emailVerifiedAt),
    lastLoginAt: row.lastLoginAt,
    customPermissions: row.customPermissions,
    createdAt: row.createdAt,
  };
}

function isMarketplaceRole(roleKey: string) {
  return roleKey === "teacher" || roleKey === "student" || roleKey === "parent";
}

async function ensureMarketplaceProfile(userId: string, roleKey: string) {
  if (roleKey === "teacher") {
    await db.insert(teacherProfiles).values({ userId }).onConflictDoNothing();
  } else if (roleKey === "parent") {
    await db.insert(parentProfiles).values({ userId }).onConflictDoNothing();
  } else if (roleKey === "student") {
    await db.insert(studentProfiles).values({ userId }).onConflictDoNothing();
  }
}

function isApiLockError(error: unknown) {
  return error instanceof Error && error.message.includes("Could not acquire lock");
}
