import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getTeacherApplication } from "@/server/teacher/applications";
import { reviewTeacherDocumentSchema } from "@/server/teacher/schemas";
import { reviewTeacherDocument } from "@/server/teacher/verification";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "teachers.documents.review",
    rateLimit: "sensitive",
    input: reviewTeacherDocumentSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Document id is required");
    }

    const { teacherUserId } = await reviewTeacherDocument(
      actor!,
      params.id,
      input,
      ip,
    );
    return getTeacherApplication(teacherUserId);
  },
);
