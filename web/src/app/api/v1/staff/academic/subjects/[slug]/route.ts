import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateSubjectSchema } from "@/server/staff/schemas";
import { updateSubject } from "@/server/staff/academic";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "academic.curriculum",
    rateLimit: "sensitive",
    input: updateSubjectSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.slug) {
      throw new ApiError(400, "VALIDATION", "Subject slug is required");
    }
    return updateSubject(actor!, params.slug, input, ip);
  },
);
