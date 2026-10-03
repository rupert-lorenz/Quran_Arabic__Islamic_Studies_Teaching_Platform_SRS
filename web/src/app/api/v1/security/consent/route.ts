import { apiRoute } from "@/server/api/handler";
import { consentSchema, setPrivacyConsent } from "@/server/security/privacy";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    csrf: true,
    rateLimit: "sensitive",
    input: consentSchema,
  },
  async ({ actor, input, ip }) => setPrivacyConsent(actor!, input, ip),
);
