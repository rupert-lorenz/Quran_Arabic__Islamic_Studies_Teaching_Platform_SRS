import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { permissions, rolePermissions, roles } from "@/db/schema";
import { ApiError } from "@/server/api/errors";
import { invalidateRolePermissions } from "./permissions";

export async function replaceRolePermissions(roleKey: string, keys: string[]) {
  if (roleKey === "super_admin") {
    throw new ApiError(
      400,
      "ROLE_LOCKED",
      "Super Admin always has every permission",
    );
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.key, roleKey as (typeof roles.$inferSelect)["key"]))
    .limit(1);

  if (!role) {
    throw new ApiError(404, "NOT_FOUND", "Role not found");
  }

  const uniqueKeys = [...new Set(keys)];
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
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    if (permissionRows.length > 0) {
      await tx.insert(rolePermissions).values(
        permissionRows.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      );
    }
  });

  await invalidateRolePermissions(roleKey);
  return { roleKey, permissions: uniqueKeys };
}
