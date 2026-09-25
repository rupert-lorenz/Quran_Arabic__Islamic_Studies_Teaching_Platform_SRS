import { apiRoute } from "@/server/api/handler";
import { getIntegrationStatus } from "@/server/integrations";
import { getConfig } from "@/server/config";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "public", rateLimit: "health", envelope: false },
  async () => {
    const config = getConfig();
    if (!config.exposePlatformHealth) {
      return new Response(null, { status: 404 });
    }

    return {
      ok: true,
      version: "v1",
      csrf: "same-origin on authenticated mutations",
      sessionCookie: "tp_session",
      cardData: "never_stored",
      corsOrigins: config.corsOrigins,
      rateLimit: {
        windowSeconds: config.rateLimitWindowSeconds,
        public: config.rateLimitPublicMax,
        sensitive: config.rateLimitSensitiveMax,
        health: config.rateLimitHealthMax,
      },
      integrations: getIntegrationStatus(),
    };
  },
);

export const POST = apiRoute(
  { auth: "public", csrf: true, rateLimit: "sensitive" },
  async () => {
    if (!getConfig().exposePlatformHealth) {
      return new Response(null, { status: 404 });
    }

    return { csrf: "accepted" };
  },
);
