import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateLocale } from "@/server/staff/i18n";
import { updateLocaleSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: updateLocaleSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.code) {
      throw new ApiError(400, "VALIDATION", "Language code is required");
    }
    return updateLocale(actor!, params.code, input, ip);
  },
);
