import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { addTeacherDocumentSchema } from "@/server/teacher/schemas";
import { addTeacherDocument } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: addTeacherDocumentSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can add documents");
    }
    return addTeacherDocument(actor!, input, ip);
  },
);
