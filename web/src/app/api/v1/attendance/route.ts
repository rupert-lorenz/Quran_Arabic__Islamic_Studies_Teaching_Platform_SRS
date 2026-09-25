import { apiRoute } from "@/server/api/handler";
import { getAttendanceDesk } from "@/server/lms/attendance";
import { listAttendanceSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listAttendanceSchema,
  },
  async ({ actor, input }) =>
    getAttendanceDesk(actor!, { studentUserId: input.studentUserId }),
);
