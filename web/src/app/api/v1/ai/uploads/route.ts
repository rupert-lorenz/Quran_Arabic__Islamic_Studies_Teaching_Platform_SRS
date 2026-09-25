import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { generateQuizFromUploadedDocument } from "@/server/ai/service";
import { AI_LOCALES } from "@/lib/ai-systems";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, request, ip }) => {
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File)) {
      throw new ApiError(400, "VALIDATION", "Choose a document to write a quiz from");
    }
    const classroomId = String(form.get("classroomId") ?? "");
    if (!classroomId) {
      throw new ApiError(400, "VALIDATION", "Choose a lesson for this quiz");
    }
    const localeValue = String(form.get("locale") ?? "");
    const locale = (AI_LOCALES as readonly string[]).includes(localeValue)
      ? (localeValue as (typeof AI_LOCALES)[number])
      : undefined;
    return generateQuizFromUploadedDocument(
      actor!,
      {
        classroomId,
        locale,
        name: uploaded.name,
        mimeType: uploaded.type,
        bytes: Buffer.from(await uploaded.arrayBuffer()),
      },
      ip,
    );
  },
);
