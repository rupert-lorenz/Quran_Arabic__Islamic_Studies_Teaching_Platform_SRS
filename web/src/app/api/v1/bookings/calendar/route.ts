import { apiRoute } from "@/server/api/handler";
import { lessonCalendarQuerySchema } from "@/server/booking/schemas";
import { getLessonCalendar } from "@/server/booking/calendar";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: lessonCalendarQuerySchema,
  },
  async ({ actor, input }) => getLessonCalendar(actor!, input.from, input.timeZone),
);
