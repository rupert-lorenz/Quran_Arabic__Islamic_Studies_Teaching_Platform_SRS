import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getLessonHistoryState } from "@/server/student/lessons";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    if (actor!.roleKey !== "student") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only students can view these lessons",
      );
    }
    return getLessonHistoryState(actor!.userId);
  },
);
