import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { addTeacherVideoSchema } from "@/server/teacher/schemas";
import { setTeacherVideo } from "@/server/teacher/onboarding";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: addTeacherVideoSchema,
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can add a video");
    }
    return setTeacherVideo(actor!, input, ip);
  },
);
