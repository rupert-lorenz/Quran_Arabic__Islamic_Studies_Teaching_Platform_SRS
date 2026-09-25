import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { classroomSyncSchema } from "@/server/classroom/schemas";
import { syncClassroom } from "@/server/classroom/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: classroomSyncSchema,
  },
  async ({ actor, params, input }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return syncClassroom(actor!, params.id, input.after);
  },
);
