import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getPublicTeacher } from "@/server/teacher/public";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "public", rateLimit: "public" }, async ({ params }) => {
  if (!params.id) {
    throw new ApiError(400, "VALIDATION", "Teacher id is required");
  }
  return getPublicTeacher(params.id);
});
