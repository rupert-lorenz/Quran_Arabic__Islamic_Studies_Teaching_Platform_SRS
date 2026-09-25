import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { uploadHomeworkFile } from "@/server/lms/homework";
import { homeworkFileKindSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, request, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Homework id is required");
    }
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File)) {
      throw new ApiError(400, "VALIDATION", "Choose a file to attach");
    }
    return uploadHomeworkFile(
      actor!,
      {
        homeworkId: params.id,
        kind: homeworkFileKindSchema.parse(String(form.get("kind") ?? "")),
        studentUserId: String(form.get("studentUserId") ?? "") || undefined,
        name: uploaded.name,
        mimeType: uploaded.type,
        bytes: Buffer.from(await uploaded.arrayBuffer()),
      },
      ip,
    );
  },
);
