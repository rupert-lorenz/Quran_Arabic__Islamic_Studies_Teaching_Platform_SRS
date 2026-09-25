import { randomBytes } from "node:crypto";
import { redis } from "./client";

const LOCK_PREFIX = "lock:";
const releaseLockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export function lockKey(name: string) {
  return `${LOCK_PREFIX}${name}`;
}

export async function acquireLock(name: string, ttlMs: number) {
  const token = randomBytes(16).toString("hex");
  const result = await redis.set(lockKey(name), token, "PX", ttlMs, "NX");

  if (result !== "OK") {
    return null;
  }

  return token;
}

export async function releaseLock(name: string, token: string) {
  const released = await redis.eval(releaseLockScript, 1, lockKey(name), token);
  return released === 1;
}

export async function withLock<T>(
  name: string,
  ttlMs: number,
  work: () => Promise<T>,
) {
  const token = await acquireLock(name, ttlMs);
  if (!token) {
    throw new Error(`Could not acquire lock: ${name}`);
  }

  try {
    return await work();
  } finally {
    await releaseLock(name, token);
  }
}
