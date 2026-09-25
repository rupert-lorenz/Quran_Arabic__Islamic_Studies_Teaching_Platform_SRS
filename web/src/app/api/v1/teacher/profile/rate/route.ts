import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateTeacherRateSchema } from "@/server/teacher/schemas";
import { updateTeacherRate } from "@/server/teacher/profile";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateTeacherRateSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can set a lesson rate");
    }
    return updateTeacherRate(actor!, input, ip);
  },
);
