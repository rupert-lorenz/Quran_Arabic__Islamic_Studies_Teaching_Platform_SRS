import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { leaveClassroom } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    return leaveClassroom(actor!, params.id);
  },
);
