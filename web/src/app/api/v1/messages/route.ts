import { apiRoute } from "@/server/api/handler";
import { getSecureInbox, sendSecureMessage } from "@/server/messages/service";
import { sendSecureMessageSchema } from "@/server/messages/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => getSecureInbox(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: sendSecureMessageSchema,
  },
  async ({ actor, input, ip }) => sendSecureMessage(actor!, input, ip),
);
