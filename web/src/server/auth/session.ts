import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { isStaffRole } from "@/lib/rbac";
import { roles, sessions, users } from "@/db/schema";
import {
  deleteSession,
  deleteUserSessions,
  getSession,
  setSession,
} from "@/redis/sessions";
import { hashToken, SESSION_COOKIE_NAME } from "@/server/api/request";
import { getConfig } from "@/server/config";
import { randomBytes } from "node:crypto";
import { isTotpEnabled } from "./two-factor-status";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  roleKey: string;
  status: "pending" | "active" | "suspended" | "rejected";
  locale: string;
  currency: string | null;
  country: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
};

export async function loadUserById(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      roleKey: roles.key,
      status: users.status,
      locale: users.locale,
      currency: users.currency,
      country: users.country,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.deletedAt) {
    return null;
  }

  if (row.status === "suspended" || row.status === "rejected") {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roleKey: row.roleKey,
    status: row.status,
    locale: row.locale,
    currency: row.currency,
    country: row.country,
    emailVerifiedAt: row.emailVerifiedAt,
    lastLoginAt: row.lastLoginAt,
  } satisfies SessionUser;
}

export async function resolveSessionToken(token: string) {
  const tokenHash = hashToken(token);
  const cached = await getSession(tokenHash).catch(() => null);

  if (cached) {
    if (new Date(cached.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    const cachedUser = await loadUserById(cached.userId);
    if (!cachedUser) {
      return null;
    }
    return rejectUnverifiedStaffSession(cachedUser, Boolean(cached.twoFactorVerified));
  }

  const [row] = await db
    .select()
    .from(sessions)
    .where(
      and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const user = await loadUserById(row.userId);
  if (!user) {
    await db.delete(sessions).where(eq(sessions.id, row.id));
    await deleteSession(tokenHash).catch(() => undefined);
    return null;
  }

  const twoFactorVerified = Boolean(row.twoFactorVerifiedAt);
  const allowed = await rejectUnverifiedStaffSession(user, twoFactorVerified);
  if (!allowed) {
    return null;
  }

  const ttlSeconds = Math.max(
    1,
    Math.floor((row.expiresAt.getTime() - Date.now()) / 1000),
  );
  await setSession(
    tokenHash,
    {
      userId: user.id,
      roleKey: user.roleKey,
      expiresAt: row.expiresAt.toISOString(),
      twoFactorVerified,
    },
    ttlSeconds,
  ).catch(() => undefined);

  return user;
}

export async function createUserSession(
  user: SessionUser,
  meta: { ip: string; userAgent: string },
  options?: { twoFactorVerified?: boolean },
) {
  const config = getConfig();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
  const twoFactorVerifiedAt = options?.twoFactorVerified ? new Date() : null;

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    twoFactorVerifiedAt,
  });

  await setSession(
    tokenHash,
    {
      userId: user.id,
      roleKey: user.roleKey,
      expiresAt: expiresAt.toISOString(),
      twoFactorVerified: Boolean(twoFactorVerifiedAt),
    },
    config.sessionTtlSeconds,
  );

  return { token, tokenHash, expiresAt };
}

async function rejectUnverifiedStaffSession(
  user: SessionUser,
  twoFactorVerified: boolean,
) {
  if (
    isStaffRole(user.roleKey) &&
    (await isTotpEnabled(user.id)) &&
    !twoFactorVerified
  ) {
    return null;
  }

  return user;
}

export async function destroyCurrentSession(token?: string) {
  if (!token) return;
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  await deleteSession(tokenHash).catch(() => undefined);
}

export async function destroyAllUserSessions(userId: string) {
  const hashes = await deleteUserSessions(userId).catch(() => [] as string[]);
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return hashes;
}

export async function getServerUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return resolveSessionToken(token);
}
