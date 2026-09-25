import { apiRoute } from "@/server/api/handler";
import { submitTeacherReviewSchema } from "@/server/reviews/schemas";
import { submitTeacherReview } from "@/server/reviews/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: submitTeacherReviewSchema,
  },
  async ({ actor, input, ip }) => submitTeacherReview(actor!, input, ip),
);
