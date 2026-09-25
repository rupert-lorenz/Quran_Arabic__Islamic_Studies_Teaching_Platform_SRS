import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { addLearningGoal, listLearningGoals } from "@/server/student/goals";
import { createLearningGoalSchema } from "@/server/student/schemas";
import { assertParentOwnsChild } from "@/server/parent/children";

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
        "Only parents can view a child's goals",
      );
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Child id is required");
    }
    await assertParentOwnsChild(actor!.userId, params.id);
    return { goals: await listLearningGoals(params.id) };
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: createLearningGoalSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only parents can add a child's goals",
      );
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Child id is required");
    }
    return addLearningGoal(actor!, params.id, input, ip);
  },
);
