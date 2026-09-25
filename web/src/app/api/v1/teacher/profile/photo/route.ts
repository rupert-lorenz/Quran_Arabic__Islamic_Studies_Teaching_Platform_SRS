import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { addTeacherVideoSchema } from "@/server/teacher/schemas";
import { setTeacherPhoto } from "@/server/teacher/photo";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: addTeacherVideoSchema.pick({ externalUrl: true }),
  },
  async ({ actor, input, ip }) => {
    if (actor!.roleKey !== "teacher") {
      throw new ApiError(403, "FORBIDDEN", "Only teachers can add a photo");
    }
    return setTeacherPhoto(actor!, input, ip);
  },
);
