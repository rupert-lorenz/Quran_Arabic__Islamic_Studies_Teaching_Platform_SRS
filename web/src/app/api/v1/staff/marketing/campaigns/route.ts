import { apiRoute } from "@/server/api/handler";
import { createCampaignSchema } from "@/server/staff/schemas";
import { createCampaign, listMarketingWorkspace } from "@/server/staff/marketing";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", permission: "marketing.campaigns", rateLimit: "sensitive" },
  async () => listMarketingWorkspace(),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "marketing.campaigns",
    rateLimit: "sensitive",
    input: createCampaignSchema,
  },
  async ({ actor, input, ip }) => createCampaign(actor!, input, ip),
);
