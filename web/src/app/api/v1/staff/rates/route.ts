import { apiRoute } from "@/server/api/handler";
import { updateTeacherRatePolicySchema } from "@/server/staff/schemas";
import { getTeacherRatePolicy, updateTeacherRatePolicy } from "@/server/staff/rates";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "teachers.approve", "payments.read"],
    rateLimit: "sensitive",
  },
  async () => getTeacherRatePolicy(),
);

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: ["settings.write", "teachers.approve"],
    rateLimit: "sensitive",
    input: updateTeacherRatePolicySchema,
  },
  async ({ actor, input, ip }) => updateTeacherRatePolicy(actor!, input, ip),
);
