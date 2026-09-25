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
    if (actor!.roleKey !== "student") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only students can update these goals",
      );
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Goal id is required");
    }
    return updateLearningGoal(actor!, actor!.userId, params.id, input, ip);
  },
);

export const DELETE = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (actor!.roleKey !== "student") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only students can remove these goals",
      );
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Goal id is required");
    }
    return removeLearningGoal(actor!, actor!.userId, params.id, ip);
  },
);
