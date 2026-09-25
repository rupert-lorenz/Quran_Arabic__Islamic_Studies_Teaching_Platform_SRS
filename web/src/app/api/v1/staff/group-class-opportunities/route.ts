import { apiRoute } from "@/server/api/handler";
import {
  createGroupClassOpportunity,
  listAdminGroupClassOpportunities,
} from "@/server/booking/group-class-opportunities";
import { createGroupClassOpportunitySchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: "classes.manage",
    rateLimit: "sensitive",
  },
  async ({ actor }) => ({
    opportunities: await listAdminGroupClassOpportunities(actor!),
  }),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "classes.manage",
    rateLimit: "sensitive",
    input: createGroupClassOpportunitySchema,
  },
  async ({ actor, input, ip }) =>
    createGroupClassOpportunity(actor!, input, ip),
);
