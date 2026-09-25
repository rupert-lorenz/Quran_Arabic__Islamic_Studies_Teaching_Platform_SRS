import { apiRoute } from "@/server/api/handler";
import { recordPrerecordedLessonProgress } from "@/server/lms/prerecorded-courses";
import { libraryPrerecordedProgressSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryPrerecordedProgressSchema,
  },
  async ({ actor, input, ip }) =>
    recordPrerecordedLessonProgress(actor!, input, ip),
);
