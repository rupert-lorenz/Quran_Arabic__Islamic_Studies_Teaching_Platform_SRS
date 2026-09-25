import { apiRoute } from "@/server/api/handler";
import {
  getQuranProgressDesk,
  saveQuranProgress,
} from "@/server/lms/islamic-progress";
import {
  listIslamicProgressSchema,
  saveQuranProgressSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listIslamicProgressSchema,
  },
  async ({ actor, input }) =>
    getQuranProgressDesk(actor!, { studentUserId: input.studentUserId }),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: saveQuranProgressSchema,
  },
  async ({ actor, input, ip }) => saveQuranProgress(actor!, input, ip),
);
