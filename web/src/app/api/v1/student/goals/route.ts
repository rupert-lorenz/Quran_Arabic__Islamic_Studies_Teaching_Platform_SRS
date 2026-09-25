import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { addLearningGoal, listLearningGoals } from "@/server/student/goals";
import { createLearningGoalSchema } from "@/server/student/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => {
    if (actor!.roleKey !== "student") {
      throw new ApiError(403, "FORBIDDEN", "Only students can view these goals");
    }
    return { goals: await listLearningGoals(actor!.userId) };
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: createLearningGoalSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "student") {
      throw new ApiError(403, "FORBIDDEN", "Only students can add these goals");
    }
    return addLearningGoal(actor!, actor!.userId, input, ip);
  },
);
