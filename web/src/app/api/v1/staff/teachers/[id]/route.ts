import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { reviewTeacherSchema } from "@/server/teacher/schemas";
import {
  getTeacherApplication,
  reviewTeacherApplication,
} from "@/server/teacher/applications";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["teachers.approve", "teachers.documents.review"],
    rateLimit: "sensitive",
  },
  async ({ params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    return getTeacherApplication(params.id);
  },
);

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: reviewTeacherSchema,
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    return reviewTeacherApplication(actor!, params.id, input, ip);
  },
);
