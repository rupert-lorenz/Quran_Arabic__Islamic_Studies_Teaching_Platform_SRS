import { redis } from "./client";
import { acquireLock, releaseLock } from "./locks";
import { deleteSession, getSession, setSession } from "./sessions";

export type RedisStatus =
  | {
      ok: true;
      ping: string;
      version: string;
      sessions: boolean;
      locks: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export async function getRedisStatus(): Promise<RedisStatus> {
  const probeId = `health:${Date.now()}`;

  try {
    const ping = await redis.ping();
    const version = (await redis.info("server")).match(
      /^redis_version:(.+)$/m,
    )?.[1];

    await setSession(
      probeId,
      {
        userId: "health-check",
        roleKey: "admin",
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      },
      5,
    );
    const session = await getSession(probeId);
    await deleteSession(probeId);

    const lockToken = await acquireLock(probeId, 5_000);
    const locked = Boolean(lockToken);
    const unlocked = lockToken ? await releaseLock(probeId, lockToken) : false;
    const sessions = Boolean(session);
    const locks = locked && unlocked;
    const ok = ping === "PONG" && sessions && locks;

    if (!ok) {
      return {
        ok: false,
        error: "Redis ping, session, or lock probe failed",
      };
    }

    return {
      ok: true,
      ping,
      version: version ?? "unknown",
      sessions,
      locks,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not connect to Redis",
    };
  }
}
