import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { downloadTeachingMaterial } from "@/server/lms/library";
import { libraryFileQuerySchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryFileQuerySchema,
  },
  async ({ actor, params, input }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Material id is required");
    }
    return downloadTeachingMaterial(actor!, params.id, input);
  },
);
