import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getTeacherApplication } from "@/server/teacher/applications";
import { updateTeacherInterviewSchema } from "@/server/teacher/schemas";
import { updateTeacherInterview } from "@/server/teacher/status";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: updateTeacherInterviewSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Interview id is required");
    }
    const teacherUserId = await updateTeacherInterview(actor!, params.id, input, ip);
    return getTeacherApplication(teacherUserId);
  },
);
