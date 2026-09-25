import { apiRoute } from "@/server/api/handler";
import { withdrawGroupClassApplication } from "@/server/booking/group-class-opportunities";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, ip, params }) =>
    withdrawGroupClassApplication(actor!, params.id, ip),
);
