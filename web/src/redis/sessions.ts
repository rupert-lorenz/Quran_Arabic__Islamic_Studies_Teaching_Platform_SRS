import { redis } from "./client";

export type CachedSession = {
  userId: string;
  roleKey: string;
  expiresAt: string;
  twoFactorVerified?: boolean;
};

const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "session-user:";

export function sessionKey(tokenHash: string) {
  return `${SESSION_PREFIX}${tokenHash}`;
}

export async function setSession(
  tokenHash: string,
  session: CachedSession,
  ttlSeconds: number,
) {
  if (ttlSeconds <= 0) {
    await redis.del(sessionKey(tokenHash));
    return;
  }

  await redis.set(
    sessionKey(tokenHash),
    JSON.stringify(session),
    "EX",
    ttlSeconds,
  );
  await redis.sadd(`${USER_SESSIONS_PREFIX}${session.userId}`, tokenHash);
  await redis.expire(`${USER_SESSIONS_PREFIX}${session.userId}`, ttlSeconds);
}

export async function getSession(tokenHash: string) {
  const value = await redis.get(sessionKey(tokenHash));
  if (!value) {
    return null;
  }

  return JSON.parse(value) as CachedSession;
}

export async function deleteSession(tokenHash: string) {
  await redis.del(sessionKey(tokenHash));
}

export async function deleteUserSessions(userId: string) {
  const key = `${USER_SESSIONS_PREFIX}${userId}`;
  const hashes = await redis.smembers(key);
  if (hashes.length > 0) {
    await redis.del(...hashes.map((hash) => sessionKey(hash)), key);
  } else {
    await redis.del(key);
  }
  return hashes;
}
