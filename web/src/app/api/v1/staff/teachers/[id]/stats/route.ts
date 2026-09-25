import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateTeacherStatsSchema } from "@/server/reviews/schemas";
import { updateTeacherMarketplaceStats } from "@/server/reviews/service";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: updateTeacherStatsSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    return updateTeacherMarketplaceStats(actor!, params.id, input, ip);
  },
);
