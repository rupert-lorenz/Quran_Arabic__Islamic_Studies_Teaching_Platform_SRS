import { apiRoute } from "@/server/api/handler";
import { selectGroupClassTeacher } from "@/server/booking/group-class-opportunities";
import { selectGroupClassTeacherSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    permission: "classes.manage",
    rateLimit: "sensitive",
    input: selectGroupClassTeacherSchema,
  },
  async ({ actor, input, ip, params }) =>
    selectGroupClassTeacher(actor!, params.id, input, ip),
);
