import { apiRoute } from "@/server/api/handler";
import { getStudentReportDesk } from "@/server/lms/reports";
import { listStudentReportsSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listStudentReportsSchema,
  },
  async ({ actor, input }) =>
    getStudentReportDesk(actor!, { studentUserId: input.studentUserId }),
);
