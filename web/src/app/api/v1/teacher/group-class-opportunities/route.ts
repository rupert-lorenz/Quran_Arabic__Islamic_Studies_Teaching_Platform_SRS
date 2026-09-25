import { ApiError } from "@/server/api/errors";
import { apiRoute } from "@/server/api/handler";
import { listTeacherGroupClassOpportunities } from "@/server/booking/group-class-opportunities";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can view class opportunities");
    }
    return {
      opportunities: await listTeacherGroupClassOpportunities(actor!.userId),
    };
  },
);
