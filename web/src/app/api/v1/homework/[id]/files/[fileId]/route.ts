import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { downloadHomeworkFile } from "@/server/lms/homework";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id || !params.fileId) {
      throw new ApiError(400, "VALIDATION", "File id is required");
    }
    return downloadHomeworkFile(actor!, params.id, params.fileId);
  },
);
