import { apiRoute } from "@/server/api/handler";
import { listGroupLessonRoster } from "@/server/booking/group-lessons";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => listGroupLessonRoster(actor!, params.id),
);
