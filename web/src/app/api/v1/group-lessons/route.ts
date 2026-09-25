import { apiRoute } from "@/server/api/handler";
import { createGroupLesson } from "@/server/booking/group-lessons";
import { createGroupLessonSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: createGroupLessonSchema,
  },
  async ({ actor, input, ip }) => createGroupLesson(actor!, input, ip),
);
