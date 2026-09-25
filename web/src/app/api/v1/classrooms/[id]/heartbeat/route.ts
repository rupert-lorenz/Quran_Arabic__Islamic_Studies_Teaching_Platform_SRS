import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { classroomHeartbeatSchema } from "@/server/classroom/schemas";
import { heartbeatClassroom } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: classroomHeartbeatSchema,
  },
  async ({ actor, params, input }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return heartbeatClassroom(actor!, params.id, input);
  },
);
