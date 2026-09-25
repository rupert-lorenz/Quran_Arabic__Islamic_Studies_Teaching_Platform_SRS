import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateCountry } from "@/server/staff/countries";
import { updateCountrySchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: updateCountrySchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.iso2) {
      throw new ApiError(400, "VALIDATION", "Country code is required");
    }
    return updateCountry(actor!, params.iso2, input, ip);
  },
);
