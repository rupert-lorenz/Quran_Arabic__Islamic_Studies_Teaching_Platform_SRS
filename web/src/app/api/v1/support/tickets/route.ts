import { apiRoute } from "@/server/api/handler";
import { createSupportTicket, createTicketSchema, listMyTickets } from "@/server/crm/records";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => listMyTickets(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    maxBody: 2_200_000,
    input: createTicketSchema,
  },
  async ({ actor, input, ip }) => createSupportTicket(actor!, input, ip),
);
