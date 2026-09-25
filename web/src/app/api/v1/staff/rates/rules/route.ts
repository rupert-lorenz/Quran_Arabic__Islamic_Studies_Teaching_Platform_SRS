import { apiRoute } from "@/server/api/handler";
import { upsertPricingControlSchema } from "@/server/staff/schemas";
import { upsertTeacherPricingControl } from "@/server/staff/rates";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "teachers.approve"],
    rateLimit: "sensitive",
    input: upsertPricingControlSchema,
  },
  async ({ actor, input, ip }) => upsertTeacherPricingControl(actor!, input, ip),
);
