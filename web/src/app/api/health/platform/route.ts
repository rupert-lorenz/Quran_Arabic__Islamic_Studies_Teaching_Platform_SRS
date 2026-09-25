import { getDatabaseStatus } from "@/db/status";
import { getRedisStatus } from "@/redis/status";
import { apiRoute } from "@/server/api/handler";
import {
  dataStores,
  designRules,
  environments,
  reservedModules,
} from "@/server/architecture";
import { getConfig, getPublicConfig } from "@/server/config";
import { getIntegrationStatus } from "@/server/integrations";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "public", rateLimit: "health", envelope: false },
  async () => {
    const config = getConfig();

    if (!config.exposePlatformHealth) {
      return new Response(null, { status: 404 });
    }

    const [database, redis] = await Promise.all([
      getDatabaseStatus(),
      getRedisStatus(),
    ]);

    const payload = {
      ok: database.ok && redis.ok,
      name: config.APP_NAME,
      env: config.APP_ENV,
      url: config.APP_URL,
      runtime: getPublicConfig(config),
      environments,
      stores: dataStores,
      reservedModules,
      designRules,
      integrations: getIntegrationStatus(),
      database,
      redis,
    };

    return Response.json(payload, {
      status: payload.ok ? 200 : 503,
    });
  },
);
