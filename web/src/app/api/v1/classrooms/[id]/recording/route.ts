import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { classroomRecordingSchema } from "@/server/classroom/schemas";
import { setClassroomRecording } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: classroomRecordingSchema,
  },
  async ({ actor, params, input }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return setClassroomRecording(actor!, params.id, input.action);
  },
);
