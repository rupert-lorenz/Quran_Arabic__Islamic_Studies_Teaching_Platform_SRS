import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { createIncidentNoteSchema } from "@/server/staff/schemas";
import { addIncidentNote } from "@/server/staff/safeguarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "safeguarding.incidents",
    rateLimit: "sensitive",
    input: createIncidentNoteSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Incident id is required");
    }
    return addIncidentNote(actor!, params.id, input, ip);
  },
);
