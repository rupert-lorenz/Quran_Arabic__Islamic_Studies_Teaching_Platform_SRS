import { apiRoute } from "@/server/api/handler";
import {
  updateEmailTemplate,
  updateEmailTemplateSchema,
} from "@/server/communications/settings";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: updateEmailTemplateSchema,
  },
  async ({ actor, input, ip }) => updateEmailTemplate(actor!, input, ip),
);
