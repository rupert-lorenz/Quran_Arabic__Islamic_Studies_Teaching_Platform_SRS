import { apiRoute } from "@/server/api/handler";
import { cancelGroupLesson } from "@/server/booking/group-lessons";
import { cancelGroupLessonSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive", input: cancelGroupLessonSchema },
  async ({ actor, input, ip, params }) =>
    cancelGroupLesson(actor!, params.id, input.reason, ip),
);
