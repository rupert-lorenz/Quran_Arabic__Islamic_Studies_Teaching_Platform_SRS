import { apiRoute } from "@/server/api/handler";
import { requestTeacherPayoutSchema } from "@/server/finance/schemas";
import { requestTeacherPayout } from "@/server/finance/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: requestTeacherPayoutSchema,
  },
  async ({ actor, input, ip }) => requestTeacherPayout(actor!, input, ip),
);
