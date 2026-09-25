import { apiRoute } from "@/server/api/handler";
import { closeGroupClassOpportunity } from "@/server/booking/group-class-opportunities";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "classes.manage",
    rateLimit: "sensitive",
  },
  async ({ actor, ip, params }) =>
    closeGroupClassOpportunity(actor!, params.id, ip),
);
