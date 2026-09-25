import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { ownTeacherReviewQuerySchema } from "@/server/reviews/schemas";
import { getOwnTeacherReview } from "@/server/reviews/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: ownTeacherReviewQuerySchema,
  },
  async ({ actor, input }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(403, "FORBIDDEN", "Only parents can review teachers");
    }
    return {
      review: await getOwnTeacherReview(actor!.userId, input.teacherUserId),
    };
  },
);
