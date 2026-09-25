import { apiRoute } from "@/server/api/handler";
import { createLiveCourse } from "@/server/booking/live-courses";
import { createLiveCourseSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  { auth: "session", rateLimit: "sensitive", input: createLiveCourseSchema },
  async ({ actor, input, ip }) => createLiveCourse(actor!, input, ip),
);
