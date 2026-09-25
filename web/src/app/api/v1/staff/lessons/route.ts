import { apiRoute } from "@/server/api/handler";
import {
  getLessonHistoryState,
  listRecentLessonHistory,
  recordLesson,
  resolveStudentUserId,
} from "@/server/student/lessons";
import {
  listLessonHistorySchema,
  recordLessonSchema,
} from "@/server/student/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["classes.manage", "students.manage"],
    rateLimit: "sensitive",
    input: listLessonHistorySchema,
  },
  async ({ input }) => {
    const studentUserId = await resolveStudentUserId(input);
    if (!studentUserId) {
      return listRecentLessonHistory();
    }
    return getLessonHistoryState(studentUserId);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: ["classes.manage", "students.manage"],
    rateLimit: "sensitive",
    input: recordLessonSchema,
  },
  async ({ actor, input, ip }) => recordLesson(actor!, input, ip),
);
