import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  getQuiz,
  importQuizFromBank,
  markQuizAttempt,
  saveQuiz,
  saveQuizQuestionToBank,
  setQuizStatus,
  sitQuiz,
} from "@/server/lms/quizzes";
import { quizActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Quiz id is required");
    }
    return getQuiz(actor!, params.id);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: quizActionSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Quiz id is required");
    }
    if (input.action === "save") {
      return saveQuiz(
        actor!,
        {
          quizId: params.id,
          title: input.title,
          instructions: input.instructions,
          subjectSlug: input.subjectSlug,
          passPercent: input.passPercent,
          attemptLimit: input.attemptLimit,
          randomiseQuestions: input.randomiseQuestions,
          payload: input.payload,
        },
        ip,
      );
    }
    if (input.action === "set_status") {
      return setQuizStatus(
        actor!,
        { quizId: params.id, status: input.status },
        ip,
      );
    }
    if (input.action === "import_bank") {
      return importQuizFromBank(
        actor!,
        { quizId: params.id, questionIds: input.questionIds },
        ip,
      );
    }
    if (input.action === "save_to_bank") {
      return saveQuizQuestionToBank(
        actor!,
        {
          quizId: params.id,
          questionId: input.questionId,
          topic: input.topic,
        },
        ip,
      );
    }
    if (input.action === "mark") {
      return markQuizAttempt(
        actor!,
        {
          quizId: params.id,
          attemptId: input.attemptId,
          marks: input.marks,
        },
        ip,
      );
    }
    return sitQuiz(
      actor!,
      {
        quizId: params.id,
        answers: input.answers,
        studentUserId: input.studentUserId,
      },
      ip,
    );
  },
);
