import { apiRoute } from "@/server/api/handler";
import { applyGroupClassOpportunity } from "@/server/booking/group-class-opportunities";
import { applyGroupClassOpportunitySchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: applyGroupClassOpportunitySchema,
  },
  async ({ actor, input, ip, params }) =>
    applyGroupClassOpportunity(actor!, params.id, input, ip),
);
