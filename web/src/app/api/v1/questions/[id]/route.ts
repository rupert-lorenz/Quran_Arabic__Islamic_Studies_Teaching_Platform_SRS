import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  getQuestionBankItem,
  saveQuestionBankItem,
} from "@/server/lms/question-bank";
import { questionBankSaveSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Question id is required");
    }
    return getQuestionBankItem(actor!, params.id);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: questionBankSaveSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Question id is required");
    }
    return saveQuestionBankItem(actor!, { id: params.id, ...input }, ip);
  },
);
