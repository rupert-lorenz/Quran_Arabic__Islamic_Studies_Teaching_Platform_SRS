import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { downloadTeachingBookPage } from "@/server/lms/library";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id || !params.pageId) {
      throw new ApiError(400, "VALIDATION", "Book page is required");
    }
    return downloadTeachingBookPage(actor!, params.id, params.pageId);
  },
);
