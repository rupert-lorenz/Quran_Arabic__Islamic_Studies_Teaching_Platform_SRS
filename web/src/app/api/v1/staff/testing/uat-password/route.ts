import { apiRoute } from "@/server/api/handler";
import { setUatPassword, uatPasswordSchema } from "@/server/testing/uat-accounts";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    csrf: true,
    permission: "users.write",
    rateLimit: "sensitive",
    input: uatPasswordSchema,
  },
  async ({ actor, input, ip }) => setUatPassword(actor!, input, ip),
);
