import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateCurrency } from "@/server/staff/currencies";
import { updateCurrencySchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: updateCurrencySchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.code) {
      throw new ApiError(400, "VALIDATION", "Currency code is required");
    }
    return updateCurrency(actor!, params.code, input, ip);
  },
);
