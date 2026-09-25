import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { submitTeacherApplication } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can submit an application");
    }
    return submitTeacherApplication(actor!, ip);
  },
);
