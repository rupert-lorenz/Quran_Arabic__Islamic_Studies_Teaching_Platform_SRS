import { ApiError } from "@/server/api/errors";
import { apiRoute } from "@/server/api/handler";
import { cancelGroupLessonSeries } from "@/server/booking/group-lessons";
import { cancelGroupLessonSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: cancelGroupLessonSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Group class id is required");
    }
    return cancelGroupLessonSeries(actor!, params.id, input.reason, ip);
  },
);
