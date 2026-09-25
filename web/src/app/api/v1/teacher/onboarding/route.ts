import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getOnboardingState } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can open onboarding");
    }
    return getOnboardingState(actor!.userId);
  },
);
