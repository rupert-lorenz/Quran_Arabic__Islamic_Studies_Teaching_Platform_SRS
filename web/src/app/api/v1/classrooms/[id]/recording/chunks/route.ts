import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { appendClassroomRecordingChunk } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "public",
  },
  async ({ actor, params, request }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Classroom id is required");
    }
    const form = await request.formData();
    const recordingId = String(form.get("recordingId") ?? "").trim();
    const uploaded = form.get("chunk");
    const mimeType = String(form.get("mimeType") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(recordingId)) {
      throw new ApiError(400, "VALIDATION", "Recording id is required");
    }
    if (!(uploaded instanceof File)) {
      throw new ApiError(400, "VALIDATION", "Recording chunk is required");
    }
    return appendClassroomRecordingChunk(actor!, params.id, {
      recordingId,
      bytes: Buffer.from(await uploaded.arrayBuffer()),
      mimeType: mimeType || uploaded.type || undefined,
    });
  },
);
