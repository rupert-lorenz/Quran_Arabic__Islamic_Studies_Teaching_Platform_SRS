import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { assertParentOwnsChild } from "@/server/parent/children";
import { getLessonHistoryState } from "@/server/student/lessons";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only parents can view a child's lessons",
      );
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Child id is required");
    }
    await assertParentOwnsChild(actor!.userId, params.id);
    return getLessonHistoryState(params.id);
  },
);
