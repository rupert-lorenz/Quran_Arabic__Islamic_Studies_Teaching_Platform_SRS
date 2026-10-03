import { apiRoute } from "@/server/api/handler";
import { createAccountSchema, createCrmAccount } from "@/server/crm/records";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "crm.manage",
    rateLimit: "sensitive",
    input: createAccountSchema,
  },
  async ({ actor, input, ip }) => createCrmAccount(actor!, input, ip),
);
