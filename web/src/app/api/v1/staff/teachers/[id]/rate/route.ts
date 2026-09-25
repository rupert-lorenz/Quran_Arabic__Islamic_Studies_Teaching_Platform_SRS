import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateTeacherRateSchema } from "@/server/teacher/schemas";
import { updateStaffTeacherRate } from "@/server/teacher/profile";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: updateTeacherRateSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    return updateStaffTeacherRate(actor!, params.id, input, ip);
  },
);
