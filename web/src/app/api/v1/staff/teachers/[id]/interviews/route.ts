import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getTeacherApplication } from "@/server/teacher/applications";
import { requestTeacherInterviewSchema } from "@/server/teacher/schemas";
import { requestTeacherInterview } from "@/server/teacher/status";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: requestTeacherInterviewSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    await requestTeacherInterview(actor!, params.id, input, ip);
    return getTeacherApplication(params.id);
  },
);
