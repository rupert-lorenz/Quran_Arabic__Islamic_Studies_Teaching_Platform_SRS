import { apiRoute } from "@/server/api/handler";
import { searchStaff, staffSearchQuerySchema } from "@/server/staff/search";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: staffSearchQuerySchema,
  },
  async ({ actor, input }) => searchStaff(actor!, input.q),
);
