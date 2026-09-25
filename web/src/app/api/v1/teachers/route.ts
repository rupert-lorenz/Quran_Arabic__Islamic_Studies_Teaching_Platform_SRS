import { apiRoute } from "@/server/api/handler";
import { publicTeacherQuerySchema } from "@/server/teacher/schemas";
import { listPublicTeachers } from "@/server/teacher/public";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "public",
    rateLimit: "public",
    input: publicTeacherQuerySchema,
  },
  async ({ input }) => ({
    teachers: await listPublicTeachers(input),
  }),
);
