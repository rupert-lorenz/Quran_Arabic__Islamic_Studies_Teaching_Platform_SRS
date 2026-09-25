import { redis } from "@/redis/client";
import { ApiError } from "@/server/api/errors";

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 8;

function lockKey(email: string, ip: string) {
  return `auth:fail:${email}:${ip}`;
}

export async function assertNotLocked(email: string, ip: string) {
  const count = Number((await redis.get(lockKey(email, ip))) ?? 0);
  if (count >= MAX_FAILURES) {
    throw new ApiError(
      429,
      "ACCOUNT_LOCKED",
      "Too many sign-in attempts. Try again in 15 minutes.",
    );
  }
}

export async function recordFailedLogin(email: string, ip: string) {
  const key = lockKey(email, ip);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
}

export async function clearFailedLogins(email: string, ip: string) {
  await redis.del(lockKey(email, ip));
}
