import { apiRoute } from "@/server/api/handler";
import { createHomework, listHomeworkDesk } from "@/server/lms/homework";
import { homeworkCreateSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listHomeworkDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: homeworkCreateSchema,
  },
  async ({ actor, input, ip }) => createHomework(actor!, input, ip),
);
