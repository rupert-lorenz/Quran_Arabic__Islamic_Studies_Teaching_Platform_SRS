import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { permissions, roles, userPermissions, users } from "@/db/schema";
import { isStaffRole } from "@/lib/rbac";
import { ApiError } from "@/server/api/errors";
import { invalidateUserPermissions } from "./effective";
import { getRolePermissions, listPermissionCatalog } from "./permissions";

export async function getUserPermissionState(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      customPermissions: users.customPermissions,
      roleKey: roles.key,
      status: users.status,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  const catalog = await listPermissionCatalog();
  const rolePermissions = await getRolePermissions(row.roleKey);
  const customKeys = row.customPermissions
    ? await db
        .select({ key: permissions.key })
        .from(userPermissions)
        .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
        .where(eq(userPermissions.userId, userId))
        .then((rows) => rows.map((item) => item.key))
    : [];

  return {
    userId: row.id,
    displayName: row.displayName,
    email: row.email,
    roleKey: row.roleKey,
    status: row.status,
    locked: row.roleKey === "super_admin" || !isStaffRole(row.roleKey),
    mode: row.customPermissions ? ("custom" as const) : ("role" as const),
    rolePermissions,
    permissions: row.customPermissions ? customKeys : rolePermissions,
    catalog,
  };
}

export async function replaceUserPermissions(
  userId: string,
  input: { mode: "role" | "custom"; keys: string[] },
) {
  const state = await getUserPermissionState(userId);
  if (state.locked) {
    throw new ApiError(
      400,
      "ROLE_LOCKED",
      "This account cannot have a custom permission set",
    );
  }

  if (input.mode === "role") {
    await db.transaction(async (tx) => {
      await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
      await tx
        .update(users)
        .set({ customPermissions: false })
        .where(eq(users.id, userId));
    });
    await invalidateUserPermissions(userId);
    return getUserPermissionState(userId);
  }

  const uniqueKeys = [...new Set(input.keys)];
  const permissionRows =
    uniqueKeys.length === 0
      ? []
      : await db
          .select()
          .from(permissions)
          .where(inArray(permissions.key, uniqueKeys));

  if (permissionRows.length !== uniqueKeys.length) {
    throw new ApiError(422, "VALIDATION", "One or more permission keys are invalid");
  }

  await db.transaction(async (tx) => {
    await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
    if (permissionRows.length > 0) {
      await tx.insert(userPermissions).values(
        permissionRows.map((permission) => ({
          userId,
          permissionId: permission.id,
        })),
      );
    }
    await tx
      .update(users)
      .set({ customPermissions: true })
      .where(eq(users.id, userId));
  });

  await invalidateUserPermissions(userId);
  return getUserPermissionState(userId);
}

export async function resetUserPermissionsToRole(userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
    await tx
      .update(users)
      .set({ customPermissions: false })
      .where(eq(users.id, userId));
  });
  await invalidateUserPermissions(userId);
}

export async function listAdminAccounts() {
  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      roleKey: roles.key,
      customPermissions: users.customPermissions,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.key, "admin"), isNull(users.deletedAt)));
}
