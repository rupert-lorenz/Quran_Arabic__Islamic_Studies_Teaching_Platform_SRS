import { apiRoute } from "@/server/api/handler";
import { createExam, listExamsDesk } from "@/server/lms/exams";
import { examCreateSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listExamsDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: examCreateSchema,
  },
  async ({ actor, input, ip }) => createExam(actor!, input, ip),
);
