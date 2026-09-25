import { apiRoute } from "@/server/api/handler";
import { createCountry, listCountryWorkspace } from "@/server/staff/countries";
import { createCountrySchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
  },
  async () => listCountryWorkspace(),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: createCountrySchema,
  },
  async ({ actor, input, ip }) => createCountry(actor!, input, ip),
);
