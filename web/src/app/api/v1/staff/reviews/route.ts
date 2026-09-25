import { apiRoute } from "@/server/api/handler";
import { staffReviewsQuerySchema } from "@/server/reviews/schemas";
import { listStaffTeacherReviews } from "@/server/reviews/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["reviews.moderate", "teachers.approve"],
    rateLimit: "sensitive",
    input: staffReviewsQuerySchema,
  },
  async ({ input }) => ({
    reviews: await listStaffTeacherReviews(input.status),
  }),
);
