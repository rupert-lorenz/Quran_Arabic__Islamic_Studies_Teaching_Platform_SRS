import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { classroomPresentationSchema } from "@/server/classroom/schemas";
import { updateClassroomPresentation } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: classroomPresentationSchema,
  },
  async ({ actor, params, input }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return updateClassroomPresentation(actor!, params.id, input);
  },
);
