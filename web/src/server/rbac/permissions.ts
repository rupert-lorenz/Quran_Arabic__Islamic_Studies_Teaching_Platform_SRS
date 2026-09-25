import { eq } from "drizzle-orm";
import { db } from "@/db";
import { permissions, rolePermissions, roles } from "@/db/schema";
import { redis } from "@/redis/client";

type RoleKey = (typeof roles.$inferSelect)["key"];

function asRoleKey(roleKey: string): RoleKey {
  return roleKey as RoleKey;
}

const CACHE_TTL_SECONDS = 60;

function cacheKey(roleKey: string) {
  return `rbac:role:${roleKey}`;
}

export async function listPermissionCatalog() {
  return db
    .select({
      key: permissions.key,
      name: permissions.name,
      group: permissions.group,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(permissions.group, permissions.key);
}

export async function getRolePermissions(roleKey: string) {
  const cached = await redis.get(cacheKey(roleKey)).catch(() => null);
  if (cached) {
    return JSON.parse(cached) as string[];
  }

  const keys =
    roleKey === "super_admin"
      ? (await listPermissionCatalog()).map((permission) => permission.key)
      : await loadAssignedPermissions(roleKey);

  await redis
    .set(cacheKey(roleKey), JSON.stringify(keys), "EX", CACHE_TTL_SECONDS)
    .catch(() => undefined);

  return keys;
}

async function loadAssignedPermissions(roleKey: string) {
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(roles.key, asRoleKey(roleKey)));

  return rows.map((row) => row.key);
}

export async function invalidateRolePermissions(roleKey: string) {
  await redis.del(cacheKey(roleKey)).catch(() => undefined);
}

export async function listRolesWithPermissions() {
  const roleRows = await db.select().from(roles).orderBy(roles.name);
  const catalog = await listPermissionCatalog();

  return Promise.all(
    roleRows.map(async (role) => ({
      key: role.key,
      name: role.name,
      description: role.description,
      locked: role.key === "super_admin",
      permissions: await getRolePermissions(role.key),
    })),
  ).then((rolesWithPermissions) => ({
    catalog,
    roles: rolesWithPermissions,
  }));
}
