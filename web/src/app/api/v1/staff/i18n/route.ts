import { apiRoute } from "@/server/api/handler";
import { listI18nWorkspace } from "@/server/staff/i18n";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "cms.write"],
    rateLimit: "sensitive",
  },
  async ({ actor }) => listI18nWorkspace(actor!),
);
