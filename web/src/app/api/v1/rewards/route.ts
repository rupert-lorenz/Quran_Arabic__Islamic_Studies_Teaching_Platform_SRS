import { apiRoute } from "@/server/api/handler";
import { getRewardDesk } from "@/server/lms/gamification";
import { listRewardsSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listRewardsSchema,
  },
  async ({ actor, input }) =>
    getRewardDesk(actor!, { studentUserId: input.studentUserId }),
);
