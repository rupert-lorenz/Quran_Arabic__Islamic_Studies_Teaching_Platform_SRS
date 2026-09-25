import { apiRoute } from "@/server/api/handler";
import {
  getArabicProgressDesk,
  saveArabicProgress,
} from "@/server/lms/islamic-progress";
import {
  listIslamicProgressSchema,
  saveArabicProgressSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listIslamicProgressSchema,
  },
  async ({ actor, input }) =>
    getArabicProgressDesk(actor!, { studentUserId: input.studentUserId }),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: saveArabicProgressSchema,
  },
  async ({ actor, input, ip }) => saveArabicProgress(actor!, input, ip),
);
