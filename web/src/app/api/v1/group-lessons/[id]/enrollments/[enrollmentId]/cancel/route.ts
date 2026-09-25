import { apiRoute } from "@/server/api/handler";
import { cancelGroupEnrollment } from "@/server/booking/group-lessons";
import { cancelGroupLessonSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive", input: cancelGroupLessonSchema },
  async ({ actor, input, ip, params }) =>
    cancelGroupEnrollment(
      actor!,
      params.id,
      params.enrollmentId,
      input.reason,
      ip,
    ),
);
