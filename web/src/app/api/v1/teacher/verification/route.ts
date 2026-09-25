import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getTeacherVerificationSummary } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only teachers can view verification status",
      );
    }
    return getTeacherVerificationSummary(actor!.userId);
  },
);
