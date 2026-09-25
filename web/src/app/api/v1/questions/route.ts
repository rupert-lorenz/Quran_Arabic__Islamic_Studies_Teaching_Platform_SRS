import { apiRoute } from "@/server/api/handler";
import {
  createQuestionBankItem,
  listQuestionBankDesk,
} from "@/server/lms/question-bank";
import {
  listQuestionBankSchema,
  questionBankCreateSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listQuestionBankSchema,
  },
  async ({ actor, input }) => listQuestionBankDesk(actor!, input),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: questionBankCreateSchema,
  },
  async ({ actor, input, ip }) => createQuestionBankItem(actor!, input, ip),
);
