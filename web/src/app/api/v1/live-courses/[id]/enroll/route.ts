import { apiRoute } from "@/server/api/handler";
import { enrollLiveCourse } from "@/server/booking/live-courses";
import { enrollLiveCourseSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive", input: enrollLiveCourseSchema },
  async ({ actor, input, ip, params }) =>
    enrollLiveCourse(actor!, params.id, input, ip),
);
