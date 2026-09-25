import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { removeTeacherDocument } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const DELETE = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can remove documents");
    }
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Document id is required");
    }
    return removeTeacherDocument(actor!, params.id, ip);
  },
);
