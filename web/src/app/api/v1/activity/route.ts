import { apiRoute } from "@/server/api/handler";
import { getPresenceDesk } from "@/server/lms/presence";
import { listAttendanceSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listAttendanceSchema,
  },
  async ({ actor, input }) =>
    getPresenceDesk(actor!, { studentUserId: input.studentUserId }),
);
