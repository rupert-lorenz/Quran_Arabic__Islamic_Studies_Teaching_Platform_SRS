import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  getExam,
  importExamFromBank,
  markExamSitting,
  saveExam,
  setExamStatus,
  startExam,
  submitExam,
} from "@/server/lms/exams";
import { examActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Exam id is required");
    }
    return getExam(actor!, params.id);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: examActionSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Exam id is required");
    }
    if (input.action === "save") {
      return saveExam(actor!, { examId: params.id, ...input }, ip);
    }
    if (input.action === "set_status") {
      return setExamStatus(
        actor!,
        { examId: params.id, status: input.status },
        ip,
      );
    }
    if (input.action === "import_bank") {
      return importExamFromBank(
        actor!,
        { examId: params.id, questionIds: input.questionIds },
        ip,
      );
    }
    if (input.action === "start") {
      return startExam(
        actor!,
        { examId: params.id, studentUserId: input.studentUserId },
        ip,
      );
    }
    if (input.action === "mark") {
      return markExamSitting(
        actor!,
        {
          examId: params.id,
          studentUserId: input.studentUserId,
          marks: input.marks,
        },
        ip,
      );
    }
    return submitExam(
      actor!,
      {
        examId: params.id,
        answers: input.answers,
        studentUserId: input.studentUserId,
      },
      ip,
    );
  },
);
