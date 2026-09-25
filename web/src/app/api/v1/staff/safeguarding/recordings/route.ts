import { apiRoute } from "@/server/api/handler";
import { createRecordingReviewSchema } from "@/server/staff/schemas";
import { createRecordingReview } from "@/server/staff/safeguarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "safeguarding.recordings",
    rateLimit: "sensitive",
    input: createRecordingReviewSchema,
  },
  async ({ actor, input, ip }) => createRecordingReview(actor!, input, ip),
);
