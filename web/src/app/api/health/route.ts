import { getDatabaseStatus } from "@/db/status";
import { getRedisStatus } from "@/redis/status";
import { apiRoute } from "@/server/api/handler";
import { getConfig } from "@/server/config";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "public", rateLimit: "health", envelope: false },
  async () => {
    const config = getConfig();
    const [database, redis] = await Promise.all([
      getDatabaseStatus(),
      getRedisStatus(),
    ]);

    return {
      ok: database.ok && redis.ok,
      name: config.APP_NAME,
      env: config.APP_ENV,
      logLevel: config.logLevel,
      database: database.ok,
      redis: redis.ok,
    };
  },
);
