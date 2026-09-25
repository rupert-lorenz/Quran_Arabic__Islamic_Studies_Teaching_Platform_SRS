import { eq } from "drizzle-orm";
import { db } from "@/db";
import { permissions, userPermissions, users } from "@/db/schema";
import { redis } from "@/redis/client";
import { getRolePermissions, listPermissionCatalog } from "./permissions";

const CACHE_TTL_SECONDS = 60;

function userCacheKey(userId: string) {
  return `rbac:user:${userId}`;
}

export async function getEffectivePermissions(userId: string, roleKey: string) {
  if (roleKey === "super_admin") {
    return (await listPermissionCatalog()).map((permission) => permission.key);
  }

  const [row] = await db
    .select({ customPermissions: users.customPermissions })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.customPermissions) {
    return getRolePermissions(roleKey);
  }

  const cached = await redis.get(userCacheKey(userId)).catch(() => null);
  if (cached) {
    return JSON.parse(cached) as string[];
  }

  const keys = await loadUserPermissions(userId);
  await redis
    .set(userCacheKey(userId), JSON.stringify(keys), "EX", CACHE_TTL_SECONDS)
    .catch(() => undefined);

  return keys;
}

export async function invalidateUserPermissions(userId: string) {
  await redis.del(userCacheKey(userId)).catch(() => undefined);
}

async function loadUserPermissions(userId: string) {
  const rows = await db
    .select({ key: permissions.key })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.userId, userId));

  return rows.map((row) => row.key);
}
