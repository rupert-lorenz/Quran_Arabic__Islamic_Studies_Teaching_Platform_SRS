import { apiRoute } from "@/server/api/handler";
import { joinClassroomSchema } from "@/server/classroom/schemas";
import { joinClassroom } from "@/server/classroom/service";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: joinClassroomSchema,
  },
  async ({ actor, input }) => joinClassroom(actor!, input),
);
