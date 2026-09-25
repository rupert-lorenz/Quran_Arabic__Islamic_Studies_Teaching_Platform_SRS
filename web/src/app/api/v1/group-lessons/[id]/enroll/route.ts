import { apiRoute } from "@/server/api/handler";
import { enrollGroupLesson } from "@/server/booking/group-lessons";
import { enrollGroupLessonSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: enrollGroupLessonSchema,
  },
  async ({ actor, input, ip, params }) =>
    enrollGroupLesson(actor!, params.id, input, ip),
);
