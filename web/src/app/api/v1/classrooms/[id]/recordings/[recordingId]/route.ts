import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { classroomRecordingRetainSchema } from "@/server/classroom/schemas";
import {
  downloadClassroomRecording,
  setClassroomRecordingRetained,
} from "@/server/classroom/recording-access";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id || !params.recordingId) {
      throw new ApiError(400, "VALIDATION", "Recording id is required");
    }
    return downloadClassroomRecording(actor!, params.id, params.recordingId);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: classroomRecordingRetainSchema,
  },
  async ({ actor, params, input, ip }) => {
    if (!params.id || !params.recordingId) {
      throw new ApiError(400, "VALIDATION", "Recording id is required");
    }
    return setClassroomRecordingRetained(
      actor!,
      params.id,
      params.recordingId,
      input.retained,
      ip,
    );
  },
);
