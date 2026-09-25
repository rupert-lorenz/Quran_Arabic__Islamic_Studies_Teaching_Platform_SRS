import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  removeLearningGoal,
  updateLearningGoal,
} from "@/server/student/goals";
import { updateLearningGoalSchema } from "@/server/student/schemas";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: updateLearningGoalSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only parents can update a child's goals",
      );
    }
    if (!params.id || !params.goalId) {
      throw new ApiError(400, "VALIDATION", "Child and goal ids are required");
    }
    return updateLearningGoal(actor!, params.id, params.goalId, input, ip);
  },
);

export const DELETE = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (actor!.roleKey !== "parent") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only parents can remove a child's goals",
      );
    }
    if (!params.id || !params.goalId) {
      throw new ApiError(400, "VALIDATION", "Child and goal ids are required");
    }
    return removeLearningGoal(actor!, params.id, params.goalId, ip);
  },
);
