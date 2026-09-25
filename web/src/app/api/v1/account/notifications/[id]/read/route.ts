import { apiRoute } from "@/server/api/handler";
import { markNotificationRead } from "@/server/notifications/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => markNotificationRead(actor!, params.id),
);
