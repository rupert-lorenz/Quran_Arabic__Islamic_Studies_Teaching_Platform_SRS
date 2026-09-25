import { apiRoute } from "@/server/api/handler";
import { updateSiteSeoSchema } from "@/server/staff/schemas";
import { getSeoWorkspace, updateSiteSeo } from "@/server/seo/site";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "cms.write"],
    rateLimit: "sensitive",
  },
  async () => getSeoWorkspace(),
);

export const PUT = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "cms.write"],
    rateLimit: "sensitive",
    input: updateSiteSeoSchema,
  },
  async ({ actor, input, ip }) => updateSiteSeo(actor!, input, ip),
);
