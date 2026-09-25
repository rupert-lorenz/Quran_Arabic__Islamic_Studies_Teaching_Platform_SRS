import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateRecordingReviewSchema } from "@/server/staff/schemas";
import { updateRecordingReview } from "@/server/staff/safeguarding";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "safeguarding.recordings",
    rateLimit: "sensitive",
    input: updateRecordingReviewSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Recording id is required");
    }
    return updateRecordingReview(actor!, params.id, input, ip);
  },
);
