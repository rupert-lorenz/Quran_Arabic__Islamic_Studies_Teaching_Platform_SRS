import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getClassroomSession } from "@/server/classroom/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return getClassroomSession(actor!, params.id);
  },
);
