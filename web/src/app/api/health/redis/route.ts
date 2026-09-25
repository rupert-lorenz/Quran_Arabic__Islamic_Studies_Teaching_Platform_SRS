import { getRedisStatus } from "@/redis/status";
import { apiRoute } from "@/server/api/handler";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "public", rateLimit: "health", envelope: false },
  async () => getRedisStatus(),
);
