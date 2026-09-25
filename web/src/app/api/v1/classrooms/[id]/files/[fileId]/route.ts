import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  downloadClassroomFile,
  removeClassroomFile,
} from "@/server/classroom/service";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id || !params.fileId) {
      throw new ApiError(400, "VALIDATION", "Classroom file is required");
    }
    return downloadClassroomFile(actor!, params.id, params.fileId);
  },
);

export const DELETE = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id || !params.fileId) {
      throw new ApiError(400, "VALIDATION", "Classroom file is required");
    }
    return removeClassroomFile(actor!, params.id, params.fileId);
  },
);
