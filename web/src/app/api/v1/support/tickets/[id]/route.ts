import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { updateSupportTicket, updateTicketSchema } from "@/server/crm/records";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "support.tickets",
    rateLimit: "sensitive",
    input: updateTicketSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) throw new ApiError(400, "VALIDATION", "Ticket id is required");
    return updateSupportTicket(actor!, params.id, input, ip);
  },
);
