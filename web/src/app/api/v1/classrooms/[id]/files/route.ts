import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { uploadClassroomFile } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params, request }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File)) {
      throw new ApiError(400, "VALIDATION", "Choose a file to share");
    }
    return uploadClassroomFile(actor!, params.id, {
      name: uploaded.name,
      mimeType: uploaded.type,
      bytes: Buffer.from(await uploaded.arrayBuffer()),
    });
  },
);
