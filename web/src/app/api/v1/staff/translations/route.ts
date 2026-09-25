import { apiRoute } from "@/server/api/handler";
import { upsertTranslation } from "@/server/staff/i18n";
import { upsertTranslationSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const PUT = apiRoute(
  {
    auth: "session",
    permission: "cms.write",
    rateLimit: "sensitive",
    input: upsertTranslationSchema,
  },
  async ({ actor, input, ip }) => upsertTranslation(actor!, input, ip),
);
