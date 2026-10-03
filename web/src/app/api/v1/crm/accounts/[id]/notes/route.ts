import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { addCrmNote, createNoteSchema } from "@/server/crm/records";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "crm.manage",
    rateLimit: "sensitive",
    input: createNoteSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) throw new ApiError(400, "VALIDATION", "Lead id is required");
    return addCrmNote(actor!, params.id, input, ip);
  },
);
