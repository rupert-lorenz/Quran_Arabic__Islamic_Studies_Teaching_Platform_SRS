import { apiRoute } from "@/server/api/handler";
import { markAllNotificationsRead } from "@/server/notifications/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => markAllNotificationsRead(actor!),
);
