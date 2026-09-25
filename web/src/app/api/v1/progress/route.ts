import { apiRoute } from "@/server/api/handler";
import {
  getIslamicProgressDesk,
  saveIslamicProgress,
} from "@/server/lms/islamic-progress";
import {
  listIslamicProgressSchema,
  saveIslamicProgressSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listIslamicProgressSchema,
  },
  async ({ actor, input }) =>
    getIslamicProgressDesk(actor!, { studentUserId: input.studentUserId }),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: saveIslamicProgressSchema,
  },
  async ({ actor, input, ip }) => saveIslamicProgress(actor!, input, ip),
);
