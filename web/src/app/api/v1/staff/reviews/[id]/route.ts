import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { moderateTeacherReviewSchema } from "@/server/reviews/schemas";
import { moderateTeacherReview } from "@/server/reviews/service";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: ["reviews.moderate", "teachers.approve"],
    rateLimit: "sensitive",
    input: moderateTeacherReviewSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Review id is required");
    }
    return moderateTeacherReview(actor!, params.id, input, ip);
  },
);
