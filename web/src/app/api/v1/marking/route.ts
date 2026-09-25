import { apiRoute } from "@/server/api/handler";
import { listMarkingDesk } from "@/server/lms/marking";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listMarkingDesk(actor!),
);
