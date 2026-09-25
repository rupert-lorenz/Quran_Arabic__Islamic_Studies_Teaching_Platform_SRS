import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { getTeacherCalendar } from "@/server/booking/calendar";
import { teacherCalendarQuerySchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: teacherCalendarQuerySchema,
  },
  async ({ actor, input }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can manage their calendar");
    }
    return getTeacherCalendar(actor!.userId, input.from);
  },
);
