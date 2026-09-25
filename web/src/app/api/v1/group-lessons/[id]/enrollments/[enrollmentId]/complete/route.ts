import { apiRoute } from "@/server/api/handler";
import { completeGroupEnrollment } from "@/server/booking/group-lessons";
import { completeGroupEnrollmentSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: completeGroupEnrollmentSchema,
  },
  async ({ actor, input, ip, params }) =>
    completeGroupEnrollment(
      actor!,
      params.id,
      params.enrollmentId,
      input.status,
      input.notes,
      ip,
    ),
);
