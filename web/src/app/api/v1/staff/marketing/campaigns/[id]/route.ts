import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateCampaignSchema } from "@/server/staff/schemas";
import { updateCampaign } from "@/server/staff/marketing";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "marketing.campaigns",
    rateLimit: "sensitive",
    input: updateCampaignSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Campaign id is required");
    }
    return updateCampaign(actor!, params.id, input, ip);
  },
);
