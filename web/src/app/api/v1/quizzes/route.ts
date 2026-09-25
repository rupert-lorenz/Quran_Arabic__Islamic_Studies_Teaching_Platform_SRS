import { apiRoute } from "@/server/api/handler";
import { createQuiz, listQuizzesDesk } from "@/server/lms/quizzes";
import { quizCreateSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listQuizzesDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: quizCreateSchema,
  },
  async ({ actor, input, ip }) => createQuiz(actor!, input, ip),
);
