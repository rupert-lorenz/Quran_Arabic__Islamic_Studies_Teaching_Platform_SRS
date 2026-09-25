import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateIncidentSchema } from "@/server/staff/schemas";
import { updateIncident } from "@/server/staff/safeguarding";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "safeguarding.incidents",
    rateLimit: "sensitive",
    input: updateIncidentSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Incident id is required");
    }
    return updateIncident(actor!, params.id, input, ip);
  },
);
