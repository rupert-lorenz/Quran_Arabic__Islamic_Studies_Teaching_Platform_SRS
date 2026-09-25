import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateTeacherProfileSchema } from "@/server/teacher/schemas";
import { updateTeacherProfile } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateTeacherProfileSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can update this application");
    }
    return updateTeacherProfile(actor!, input, ip);
  },
);
