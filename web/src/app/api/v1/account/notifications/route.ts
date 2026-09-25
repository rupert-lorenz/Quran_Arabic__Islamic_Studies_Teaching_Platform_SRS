import { apiRoute } from "@/server/api/handler";
import { listActorNotifications } from "@/server/notifications/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => listActorNotifications(actor!),
);
