import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateAccountSchema, updateCrmAccount } from "@/server/crm/records";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "crm.manage",
    rateLimit: "sensitive",
    input: updateAccountSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) throw new ApiError(400, "VALIDATION", "Lead id is required");
    return updateCrmAccount(actor!, params.id, input, ip);
  },
);
