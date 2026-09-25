import { apiRoute } from "@/server/api/handler";
import {
  addPrerecordedCourseLesson,
  createPrerecordedCourse,
  enrollPrerecordedCourse,
  listLibraryPrerecordedDesk,
  removePrerecordedCourseLesson,
  revokePrerecordedCourseEnrollment,
  setPrerecordedCourseStatus,
} from "@/server/lms/prerecorded-courses";
import { libraryPrerecordedCourseActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibraryPrerecordedDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryPrerecordedCourseActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "create") {
      return createPrerecordedCourse(actor!, input, ip);
    }
    if (input.action === "set_status") {
      return setPrerecordedCourseStatus(actor!, input, ip);
    }
    if (input.action === "add_lesson") {
      return addPrerecordedCourseLesson(actor!, input, ip);
    }
    if (input.action === "remove_lesson") {
      return removePrerecordedCourseLesson(actor!, input, ip);
    }
    if (input.action === "enroll") {
      return enrollPrerecordedCourse(actor!, input, ip);
    }
    return revokePrerecordedCourseEnrollment(actor!, input, ip);
  },
);
