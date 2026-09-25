import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { confirmTeacherInterviewSchema } from "@/server/teacher/schemas";
import { confirmTeacherInterview } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: confirmTeacherInterviewSchema,
  },
  async ({ actor, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can confirm an interview");
    }
    return confirmTeacherInterview(actor!, ip);
  },
);
