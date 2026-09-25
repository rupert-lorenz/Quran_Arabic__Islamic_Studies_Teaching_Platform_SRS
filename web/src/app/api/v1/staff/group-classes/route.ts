import { apiRoute } from "@/server/api/handler";
import {
  createAdminGroupLesson,
  listAdminGroupTeachingTeachers,
} from "@/server/booking/group-lessons";
import { adminCreateGroupLessonSchema } from "@/server/booking/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: "classes.manage",
    rateLimit: "sensitive",
  },
  async ({ actor }) => ({
    teachers: await listAdminGroupTeachingTeachers(actor!),
  }),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "classes.manage",
    rateLimit: "sensitive",
    input: adminCreateGroupLessonSchema,
  },
  async ({ actor, input, ip }) =>
    createAdminGroupLesson(actor!, input, ip),
);
