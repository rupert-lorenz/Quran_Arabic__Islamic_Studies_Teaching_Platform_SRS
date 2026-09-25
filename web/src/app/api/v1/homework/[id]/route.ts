import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  assignHomework,
  getHomework,
  markHomework,
  setHomeworkStatus,
  submitHomework,
} from "@/server/lms/homework";
import { homeworkActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Homework id is required");
    }
    return getHomework(actor!, params.id);
  },
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: homeworkActionSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Homework id is required");
    }
    if (input.action === "set_status") {
      return setHomeworkStatus(
        actor!,
        { homeworkId: params.id, status: input.status },
        ip,
      );
    }
    if (input.action === "assign") {
      return assignHomework(
        actor!,
        {
          homeworkId: params.id,
          studentUserId: input.studentUserId,
          email: input.email,
        },
        ip,
      );
    }
    if (input.action === "submit") {
      return submitHomework(actor!, { homeworkId: params.id, text: input.text }, ip);
    }
    return markHomework(
      actor!,
      {
        homeworkId: params.id,
        studentUserId: input.studentUserId,
        markLabel: input.markLabel,
        feedback: input.feedback,
      },
      ip,
    );
  },
);
