import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { classroomSignalSchema } from "@/server/classroom/schemas";
import { postClassroomSignal } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: classroomSignalSchema,
  },
  async ({ actor, params, input }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return postClassroomSignal(actor!, params.id, input);
  },
);
